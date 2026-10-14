"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { getOrgContext } from "@/lib/auth/session";
import { formDataToObject } from "@/lib/forms/form-data";
import { getIpHash } from "@/lib/rate-limit/ip";
import { organizationInputSchema } from "@/lib/schemas/organization";
import {
  ARRAY_FIELDS,
  isStepComplete,
  LAST_STEP,
  QUESTIONNAIRE_STEPS,
  questionnaireAnswersSchema,
  stepDraftSchema,
  stepSchema,
  type QuestionnaireStep,
} from "@/lib/schemas/questionnaire";
import { logEvent } from "@/lib/supabase/events";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import type { QuestionnaireState } from "./types";

const ORG_ARRAY_FIELDS = new Set<string>([...ARRAY_FIELDS, "frameworks"]);

function friendlyMessage(issue: z.core.$ZodIssue): string {
  if (issue.code === "invalid_type") {
    return issue.expected === "string" ? "This answer is required." : "Choose an option.";
  }
  if (issue.code === "invalid_value") return "Choose an option.";
  return issue.message;
}

function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!(key in errors)) errors[key] = friendlyMessage(issue);
  }
  return errors;
}

/**
 * Saves one step of the questionnaire (SPEC.md section 7, Phase 2). Called on a debounce
 * while the user types (intent "autosave") and when they move on (intent "next"). An
 * autosave stores whatever validates loosely; moving on requires the step to be complete.
 */
export async function saveQuestionnaireStepAction(
  step: QuestionnaireStep,
  _previous: QuestionnaireState,
  formData: FormData,
): Promise<QuestionnaireState> {
  const context = await getOrgContext();
  if (!context) redirect("/app/onboarding");
  const { org, user } = context;

  const intent = formData.get("intent") === "next" ? "next" : "autosave";
  const raw = formDataToObject(formData, ORG_ARRAY_FIELDS);
  const supabase = await createClient();
  const fieldErrors: Record<string, string> = {};

  // Step 1 edits the organization row (questions 1 and 2) as well as the answers.
  if (step === 1) {
    const orgInput = organizationInputSchema.safeParse({
      name: raw.name,
      industry: raw.industry,
      headcountBand: raw.headcountBand,
      frameworks: raw.frameworks ?? [],
      timezone: raw.timezone,
    });
    if (orgInput.success) {
      const { error } = await supabase
        .from("organizations")
        .update({
          name: orgInput.data.name,
          industry: orgInput.data.industry,
          headcount_band: orgInput.data.headcountBand,
          frameworks: orgInput.data.frameworks,
          timezone: orgInput.data.timezone,
        })
        .eq("id", org.id);
      if (error) {
        console.error("[questionnaire] organization update failed:", error.message);
        return { status: "error" };
      }
    } else {
      Object.assign(fieldErrors, fieldErrorsOf(orgInput.error));
    }
  }

  const draft = stepDraftSchema(step).safeParse(raw);
  if (!draft.success) {
    return { status: "invalid", fieldErrors: fieldErrorsOf(draft.error), savedAt: null };
  }

  const { data: existing, error: loadError } = await supabase
    .from("questionnaires")
    .select("id, answers, completed_at")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (loadError) {
    console.error("[questionnaire] load failed:", loadError.message);
    return { status: "error" };
  }

  const previousAnswers =
    existing && typeof existing.answers === "object" && !Array.isArray(existing.answers)
      ? (existing.answers as Record<string, unknown>)
      : {};
  const answers = { ...previousAnswers, ...draft.data } as Json;
  const complete = questionnaireAnswersSchema.safeParse(answers).success;
  const completedAt = complete ? (existing?.completed_at ?? new Date().toISOString()) : null;

  const write = existing
    ? supabase
        .from("questionnaires")
        .update({ answers, completed_at: completedAt })
        .eq("id", existing.id)
        .select("id")
        .single()
    : supabase
        .from("questionnaires")
        .insert({ org_id: org.id, answers, completed_at: completedAt, created_by: user.id })
        .select("id")
        .single();
  const { error: writeError } = await write;
  if (writeError) {
    console.error("[questionnaire] save failed:", writeError.message);
    return { status: "error" };
  }

  if (complete && !existing?.completed_at) {
    await logEvent("questionnaire_completed", {}, getIpHash(await headers()), org.id);
  }

  const savedAt = new Date().toISOString();
  if (intent === "autosave") {
    return Object.keys(fieldErrors).length > 0
      ? { status: "invalid", fieldErrors, savedAt }
      : { status: "saved", savedAt };
  }

  const strict = stepSchema(step).safeParse(raw);
  if (!strict.success) Object.assign(fieldErrors, fieldErrorsOf(strict.error));
  if (Object.keys(fieldErrors).length > 0) return { status: "invalid", fieldErrors, savedAt };

  if (step < LAST_STEP) redirect(`/app/questionnaire?step=${step + 1}`);
  if (complete) redirect("/app/plan");
  const firstIncomplete = QUESTIONNAIRE_STEPS.find((s) => !isStepComplete(s.step, answers));
  redirect(`/app/questionnaire?step=${firstIncomplete?.step ?? 1}&incomplete=1`);
}

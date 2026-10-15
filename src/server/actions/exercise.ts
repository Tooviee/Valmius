"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getOrgContext, type OrgContext } from "@/lib/auth/session";
import { generateParticipantToken } from "@/lib/exercise/token";
import { loadExercise, loadPlanForExercise } from "@/lib/exercise/load";
import { generateScenario } from "@/lib/llm";
import { factsToPromptText } from "@/lib/plan/facts";
import { loadPlanFacts } from "@/lib/plan/load";
import { checkRateLimit } from "@/lib/rate-limit";
import { getIpHash } from "@/lib/rate-limit/ip";
import { createExerciseSchema, MAX_PARTICIPANTS } from "@/lib/schemas/exercise";
import { FRAMEWORK_REFS } from "@/lib/schemas/frameworks";
import type { HostingOption, Industry, HeadcountBand } from "@/lib/schemas/generator";
import type { Json } from "@/lib/supabase/database.types";
import { logEvent } from "@/lib/supabase/events";
import { createClient } from "@/lib/supabase/server";
import type { CreateExerciseState, CreateExerciseValues } from "./types";

const asString = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");

async function requireContext(): Promise<OrgContext> {
  const context = await getOrgContext();
  if (!context) redirect("/app/onboarding");
  return context;
}

function readValues(formData: FormData): CreateExerciseValues {
  const names = formData.getAll("participantName").map(asString);
  const emails = formData.getAll("participantEmail").map(asString);
  const roles = formData.getAll("participantRole").map(asString);
  const participants = names
    .map((name, index) => ({
      name: name.slice(0, 200),
      email: (emails[index] ?? "").slice(0, 300),
      role: (roles[index] ?? "").slice(0, 200),
    }))
    .filter((p) => p.name.trim() || p.email.trim() || p.role.trim())
    .slice(0, MAX_PARTICIPANTS + 1);
  return {
    title: asString(formData.get("title")).slice(0, 500),
    scheduledAt: asString(formData.get("scheduledAt")).slice(0, 40),
    sourceKind: asString(formData.get("sourceKind")) === "generate" ? "generate" : "pack",
    packId: asString(formData.get("packId")).slice(0, 60),
    scenarioType: asString(formData.get("scenarioType")).slice(0, 40),
    focus: asString(formData.get("focus")).slice(0, 1000),
    participants,
  };
}

/** Creates an exercise from a pack or a scenario generated from the plan (SPEC.md Phase 3). */
export async function createExerciseAction(
  _previous: CreateExerciseState,
  formData: FormData,
): Promise<CreateExerciseState> {
  const values = readValues(formData);
  const parsed = createExerciseSchema.safeParse({
    title: values.title,
    scheduledAt: values.scheduledAt || undefined,
    source:
      values.sourceKind === "generate"
        ? { kind: "generate", scenarioType: values.scenarioType, focus: values.focus }
        : { kind: "pack", scenarioId: values.packId },
    participants: values.participants,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    return { status: "invalid", values, fieldErrors };
  }

  const context = await requireContext();
  const { org, user } = context;
  const supabase = await createClient();
  const ipHash = getIpHash(await headers());
  const input = parsed.data;

  let scenarioId: string;
  if (input.source.kind === "pack") {
    const { data: pack } = await supabase
      .from("scenarios")
      .select("id")
      .eq("id", input.source.scenarioId)
      .eq("is_pack", true)
      .maybeSingle();
    if (!pack)
      return {
        status: "invalid",
        values,
        fieldErrors: { "source.scenarioId": "Choose a scenario pack." },
      };
    scenarioId = pack.id;
  } else {
    const loaded = await loadPlanFacts(supabase, org);
    if (!loaded)
      return {
        status: "error",
        values,
        message: "Finish the questionnaire before generating from the plan.",
      };

    const limit = await checkRateLimit("scenario_custom", org.id);
    if (limit === "blocked") return { status: "rate_limited", values };

    const result = await generateScenario({
      industry: org.industry as Industry,
      headcountBand: org.headcount_band as HeadcountBand,
      hosting: loaded.answers.hosting as HostingOption[],
      scenarioType: input.source.scenarioType,
      context: input.source.focus,
      planContext: factsToPromptText(loaded.facts),
    });
    await logEvent(
      "exercise_scenario_generated",
      { type: input.source.scenarioType, has_focus: input.source.focus.length > 0, ...result.meta },
      ipHash,
      org.id,
    );

    const usedRefs = new Set(result.scenario.injects.flatMap((inject) => inject.framework_refs));
    const { data: created, error } = await supabase
      .from("scenarios")
      .insert({
        org_id: org.id,
        type: result.scenario.type,
        title: result.scenario.title,
        content: result.scenario as unknown as Json,
        framework_tags: FRAMEWORK_REFS.filter((ref) => usedRefs.has(ref)),
        is_pack: false,
      })
      .select("id")
      .single();
    if (error || !created) {
      console.error("[exercise] could not store the generated scenario:", error?.message);
      return { status: "error", values };
    }
    scenarioId = created.id;
  }

  const plan = await loadPlanForExercise(supabase, org.id);
  const { data: exercise, error: exerciseError } = await supabase
    .from("exercises")
    .insert({
      org_id: org.id,
      scenario_id: scenarioId,
      ir_plan_id: plan?.id ?? null,
      title: input.title,
      scheduled_at: input.scheduledAt ?? null,
      facilitator_id: user.id,
    })
    .select("id")
    .single();
  if (exerciseError || !exercise) {
    console.error("[exercise] create failed:", exerciseError?.message);
    return { status: "error", values };
  }

  if (input.participants.length > 0) {
    const { error: participantsError } = await supabase.from("exercise_participants").insert(
      input.participants.map((p) => ({
        exercise_id: exercise.id,
        name: p.name,
        email: p.email ?? null,
        role: p.role,
        token: generateParticipantToken(),
      })),
    );
    if (participantsError) {
      console.error("[exercise] participants failed:", participantsError.message);
      return { status: "error", values };
    }
  }

  await logEvent(
    "exercise_created",
    {
      source: input.source.kind,
      scenario_type: input.source.kind === "pack" ? null : input.source.scenarioType,
      participants: input.participants.length,
      plan_version: plan?.version ?? null,
      plan_status: plan?.status ?? null,
    },
    ipHash,
    org.id,
  );
  redirect(`/app/exercises/${exercise.id}`);
}

/** Moves a scheduled exercise to live and opens the console. */
export async function startExerciseAction(formData: FormData): Promise<void> {
  const exerciseId = asString(formData.get("exerciseId"));
  const context = await requireContext();
  const supabase = await createClient();
  const exercise = await loadExercise(supabase, exerciseId);
  if (!exercise) redirect("/app/exercises");
  if (exercise.status === "scheduled") {
    const { error } = await supabase
      .from("exercises")
      .update({ status: "live", started_at: new Date().toISOString() })
      .eq("id", exercise.id)
      .eq("status", "scheduled");
    if (error) throw new Error(`Could not start the exercise: ${error.message}`);
    await logEvent(
      "exercise_started",
      { participants: exercise.participants.length },
      getIpHash(await headers()),
      context.org.id,
    );
  }
  redirect(`/app/exercises/${exercise.id}/run`);
}

/** Discards a scheduled exercise (RLS refuses anything that has run). */
export async function deleteExerciseAction(formData: FormData): Promise<void> {
  const exerciseId = asString(formData.get("exerciseId"));
  await requireContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("exercises")
    .delete()
    .eq("id", exerciseId)
    .eq("status", "scheduled");
  if (error) throw new Error(`Could not delete the exercise: ${error.message}`);
  redirect("/app/exercises");
}

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getOrgContext, type OrgContext } from "@/lib/auth/session";
import { mapWithConcurrency } from "@/lib/concurrency";
import { generatePlanSection } from "@/lib/llm";
import { loadPlan, loadPlanFacts, nextPlanVersion } from "@/lib/plan/load";
import { buildNotificationMatrixSection } from "@/lib/plan/notification-matrix";
import { checkRateLimit } from "@/lib/rate-limit";
import { getIpHash } from "@/lib/rate-limit/ip";
import {
  MODEL_SECTION_IDS,
  PLAN_SECTION_IDS,
  planSectionIdSchema,
  planSectionsSchema,
  type PlanSection,
  type PlanSections,
} from "@/lib/schemas/plan";
import type { Json } from "@/lib/supabase/database.types";
import { logEvent } from "@/lib/supabase/events";
import { createClient } from "@/lib/supabase/server";
import type {
  ApprovePlanState,
  GeneratePlanState,
  RegenerateSectionState,
  SavePlanState,
} from "./types";

// Sections are written in parallel; five at a time stays well under the workspace
// request limit (SPEC.md section 14) even with two founders generating at once.
const SECTION_CONCURRENCY = 5;
const UNIQUE_VIOLATION = "23505";
const MAX_SECTIONS_JSON_BYTES = 400_000;
const APPROVER_NAME_MAX_LENGTH = 120;

async function requireContext(): Promise<OrgContext> {
  const context = await getOrgContext();
  if (!context) redirect("/app/onboarding");
  return context;
}

/** Inserts a new plan version, retrying once if another save took the version number. */
async function insertPlanVersion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  context: OrgContext,
  questionnaireId: string,
  sections: PlanSections,
): Promise<{ id: string; version: number }> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const version = await nextPlanVersion(supabase, context.org.id);
    const { data, error } = await supabase
      .from("ir_plans")
      .insert({
        org_id: context.org.id,
        questionnaire_id: questionnaireId,
        version,
        sections: sections as unknown as Json,
        created_by: context.user.id,
      })
      .select("id, version")
      .single();
    if (!error && data) return data;
    if (error?.code !== UNIQUE_VIOLATION || attempt === 1) {
      throw new Error(`Could not save the plan: ${error?.message ?? "unknown error"}`);
    }
  }
  throw new Error("Could not save the plan");
}

/**
 * Generates a complete plan from the questionnaire (SPEC.md section 7, Phase 2): ten
 * sections from the model, the notification matrix from code, stored as a new version.
 */
export async function generatePlanAction(
  _previous: GeneratePlanState,
  formData: FormData,
): Promise<GeneratePlanState> {
  // The form carries nothing: the questionnaire is the input.
  void formData;
  const context = await requireContext();
  const supabase = await createClient();
  const loaded = await loadPlanFacts(supabase, context.org);
  if (!loaded) redirect("/app/questionnaire?incomplete=1");

  const ipHash = getIpHash(await headers());
  const limit = await checkRateLimit("plan_generate", context.org.id);
  if (limit === "blocked") return { status: "rate_limited" };
  if (limit === "unavailable") return { status: "error" };

  const startedAt = Date.now();
  const { facts, questionnaireId } = loaded;
  const results = await mapWithConcurrency(MODEL_SECTION_IDS, SECTION_CONCURRENCY, async (id) => {
    const result = await generatePlanSection(facts, id);
    await logEvent(
      "plan_section_generated",
      { section: id, ...result.meta },
      ipHash,
      context.org.id,
    );
    return result;
  });

  const byId = new Map(results.map((r) => [r.section.id, r.section]));
  const sections = PLAN_SECTION_IDS.map((id) =>
    id === "notification_matrix"
      ? buildNotificationMatrixSection(facts.matrixInput)
      : byId.get(id)!,
  );
  const parsed = planSectionsSchema.safeParse(sections);
  if (!parsed.success) {
    console.error("[plan] generated sections failed validation:", parsed.error.issues);
    return { status: "error" };
  }

  const saved = await insertPlanVersion(supabase, context, questionnaireId, parsed.data);
  await logEvent(
    "plan_generated",
    {
      version: saved.version,
      fallback_sections: results.filter((r) => r.meta.fallback_used).length,
      input_tokens: results.reduce((sum, r) => sum + r.meta.input_tokens, 0),
      output_tokens: results.reduce((sum, r) => sum + r.meta.output_tokens, 0),
      latency_ms: Date.now() - startedAt,
    },
    ipHash,
    context.org.id,
  );

  redirect(`/app/plan?v=${saved.version}`);
}

/** Rewrites one section with the model (or rebuilds the matrix). Nothing is saved. */
export async function regenerateSectionAction(
  _previous: RegenerateSectionState,
  formData: FormData,
): Promise<RegenerateSectionState> {
  const sectionId = planSectionIdSchema.safeParse(formData.get("sectionId"));
  if (!sectionId.success) return { status: "error" };

  const context = await requireContext();
  const supabase = await createClient();
  const loaded = await loadPlanFacts(supabase, context.org);
  if (!loaded) return { status: "error" };

  const ipHash = getIpHash(await headers());
  const limit = await checkRateLimit("plan_section", context.org.id);
  if (limit === "blocked") return { status: "rate_limited" };

  const id = sectionId.data;
  let section: PlanSection;
  if (id === "notification_matrix") {
    section = buildNotificationMatrixSection(loaded.facts.matrixInput);
  } else {
    const result = await generatePlanSection(loaded.facts, id);
    await logEvent(
      "plan_section_generated",
      { section: id, ...result.meta },
      ipHash,
      context.org.id,
    );
    section = result.section;
  }
  return { status: "ok", section };
}

/** Saves the edited sections as a new draft version (SPEC.md: save creates a new version). */
export async function savePlanVersionAction(
  _previous: SavePlanState,
  formData: FormData,
): Promise<SavePlanState> {
  const context = await requireContext();
  const basePlanId = formData.get("basePlanId");
  const raw = formData.get("sections");
  if (typeof basePlanId !== "string" || typeof raw !== "string") return { status: "invalid" };
  if (raw.length > MAX_SECTIONS_JSON_BYTES) return { status: "invalid" };

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { status: "invalid" };
  }
  const parsed = planSectionsSchema.safeParse(json);
  if (!parsed.success) return { status: "invalid" };

  const supabase = await createClient();
  const base = await loadPlan(supabase, basePlanId);
  if (!base) return { status: "invalid" };

  // A section the founder changed is theirs now; untouched sections keep their origin.
  const sections = parsed.data.map((section, index) => {
    const original = base.sections[index];
    const changed = section.markdown.trim() !== original.markdown.trim();
    return {
      ...section,
      title: original.title,
      framework_refs: section.framework_refs,
      origin: changed ? ("user" as const) : original.origin,
    };
  });

  const saved = await insertPlanVersion(supabase, context, base.questionnaire_id, sections);
  await logEvent(
    "plan_saved",
    { version: saved.version, from_version: base.version },
    getIpHash(await headers()),
    context.org.id,
  );
  redirect(`/app/plan?v=${saved.version}`);
}

/**
 * Approves a draft version (SPEC.md section 7, Phase 2): records who approved it and
 * when, and freezes it. Template sections must be dealt with first, since an approved
 * plan is what auditors and insurers will read.
 */
export async function approvePlanAction(
  _previous: ApprovePlanState,
  formData: FormData,
): Promise<ApprovePlanState> {
  const planId = formData.get("planId");
  const rawName = formData.get("approvedByName");
  const approvedByName = typeof rawName === "string" ? rawName.trim() : "";
  if (
    typeof planId !== "string" ||
    !approvedByName ||
    approvedByName.length > APPROVER_NAME_MAX_LENGTH
  ) {
    return { status: "invalid" };
  }

  const context = await requireContext();
  const supabase = await createClient();
  const plan = await loadPlan(supabase, planId);
  if (!plan) return { status: "invalid" };
  if (plan.status === "approved") return { status: "already_approved" };
  if (plan.sections.some((section) => section.origin === "template")) {
    return { status: "needs_review" };
  }

  const { data, error } = await supabase
    .from("ir_plans")
    .update({
      status: "approved",
      approved_by_name: approvedByName,
      approved_at: new Date().toISOString(),
    })
    .eq("id", plan.id)
    .eq("status", "draft")
    .select("version")
    .maybeSingle();
  if (error || !data) {
    console.error("[plan] approve failed:", error?.message ?? "no row updated");
    return { status: "error" };
  }

  await logEvent(
    "plan_approved",
    { version: data.version },
    getIpHash(await headers()),
    context.org.id,
  );
  redirect(`/app/plan?v=${data.version}`);
}

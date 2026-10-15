"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOrgContext, type OrgContext } from "@/lib/auth/session";
import { loadExercise, type ExerciseRecord } from "@/lib/exercise/load";
import { generateReport } from "@/lib/llm";
import { renderReportPdf } from "@/lib/pdf/report";
import { buildReportFacts } from "@/lib/report/build";
import { contentFingerprint, sha256Hex } from "@/lib/report/hash";
import { loadReport, nextReportVersion, type ReportRecord } from "@/lib/report/load";
import { reportPdfPath, StorageUnavailableError, uploadReportPdf } from "@/lib/report/storage";
import { checkRateLimit } from "@/lib/rate-limit";
import { getIpHash } from "@/lib/rate-limit/ip";
import {
  NARRATIVE_IDS,
  reportContentSchema,
  reportNarrativeSchema,
  type ReportContent,
} from "@/lib/schemas/report";
import type { Json } from "@/lib/supabase/database.types";
import { logEvent } from "@/lib/supabase/events";
import { createClient } from "@/lib/supabase/server";
import type { FinalizeReportState, GenerateReportState, SaveReportState } from "./types";

const asString = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function requireContext(): Promise<OrgContext> {
  const context = await getOrgContext();
  if (!context) redirect("/app/onboarding");
  return context;
}

const reportPath = (exerciseId: string, version?: number) =>
  `/app/exercises/${exerciseId}/report${version ? `?v=${version}` : ""}`;

function facilitatorLabel(context: OrgContext): string {
  return context.user.email ?? "Facilitator";
}

async function loadEndedExercise(
  supabase: Supabase,
  exerciseId: string,
): Promise<ExerciseRecord | null> {
  const exercise = await loadExercise(supabase, exerciseId);
  if (!exercise) return null;
  if (exercise.status !== "ended" && exercise.status !== "reported") return null;
  return exercise;
}

async function latestDraft(supabase: Supabase, exerciseId: string): Promise<ReportRecord | null> {
  const { data, error } = await supabase
    .from("reports")
    .select("id")
    .eq("exercise_id", exerciseId)
    .eq("status", "draft")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load the draft report: ${error.message}`);
  return data ? loadReport(supabase, data.id) : null;
}

/**
 * Generates (or regenerates) the narrative for the current draft from fresh facts
 * (SPEC.md section 7, Phase 4). One draft per exercise at a time.
 */
export async function generateReportAction(
  _previous: GenerateReportState,
  formData: FormData,
): Promise<GenerateReportState> {
  const exerciseId = asString(formData.get("exerciseId"));
  const context = await requireContext();
  const supabase = await createClient();
  const exercise = await loadEndedExercise(supabase, exerciseId);
  if (!exercise) return { status: "not_ended" };

  const limit = await checkRateLimit("report_generate", context.org.id);
  if (limit === "blocked") return { status: "rate_limited" };
  if (limit === "unavailable") return { status: "error" };

  const facts = buildReportFacts(context.org, exercise, facilitatorLabel(context));
  const result = await generateReport(facts);
  const ipHash = getIpHash(await headers());
  await logEvent(
    "report_generated",
    {
      decisions: facts.timeline.length,
      findings: facts.strengths.length + facts.gaps.length + facts.action_items.length,
      ...result.meta,
    },
    ipHash,
    context.org.id,
  );

  const content = reportContentSchema.parse({ ...facts, narrative: result.narrative });
  const draft = await latestDraft(supabase, exercise.id);
  if (draft) {
    const { error } = await supabase
      .from("reports")
      .update({ content: content as unknown as Json, generated_at: new Date().toISOString() })
      .eq("id", draft.id);
    if (error) {
      console.error("[report] draft update failed:", error.message);
      return { status: "error" };
    }
    revalidatePath(reportPath(exercise.id));
    redirect(reportPath(exercise.id, draft.version));
  }

  const version = await nextReportVersion(supabase, exercise.id);
  const { data, error } = await supabase
    .from("reports")
    .insert({
      exercise_id: exercise.id,
      org_id: context.org.id,
      version,
      content: content as unknown as Json,
      created_by: context.user.id,
    })
    .select("version")
    .single();
  if (error || !data) {
    console.error("[report] draft insert failed:", error?.message);
    return { status: "error" };
  }
  redirect(reportPath(exercise.id, data.version));
}

/** Saves edited narrative sections into the draft. A changed section is marked as the user's. */
export async function saveReportDraftAction(
  _previous: SaveReportState,
  formData: FormData,
): Promise<SaveReportState> {
  const reportId = asString(formData.get("reportId"));
  const fields = Object.fromEntries(NARRATIVE_IDS.map((id) => [id, asString(formData.get(id))]));
  await requireContext();
  const supabase = await createClient();
  const report = await loadReport(supabase, reportId);
  if (!report || report.status !== "draft") return { status: "error" };

  const parsed = reportNarrativeSchema.safeParse({
    ...fields,
    origin: report.content.narrative.origin,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!(key in fieldErrors))
        fieldErrors[key] = "This section needs some text (up to 8,000 characters).";
    }
    return { status: "invalid", fieldErrors };
  }
  const changed = NARRATIVE_IDS.some((id) => parsed.data[id] !== report.content.narrative[id]);
  const narrative = {
    ...parsed.data,
    origin: changed ? ("user" as const) : report.content.narrative.origin,
  };
  const content: ReportContent = { ...report.content, narrative };

  const { error } = await supabase
    .from("reports")
    .update({ content: content as unknown as Json })
    .eq("id", report.id)
    .eq("status", "draft");
  if (error) {
    console.error("[report] draft save failed:", error.message);
    return { status: "error" };
  }
  revalidatePath(reportPath(report.exercise_id));
  return { status: "saved", savedAt: new Date().toISOString() };
}

/**
 * Finalizes a draft: fresh facts plus the edited narrative are rendered to a PDF, the file
 * is stored in the private bucket, its SHA-256 recorded, the row frozen, and the exercise
 * moved to reported, which freezes its findings.
 */
export async function finalizeReportAction(
  _previous: FinalizeReportState,
  formData: FormData,
): Promise<FinalizeReportState> {
  const reportId = asString(formData.get("reportId"));
  const context = await requireContext();
  const supabase = await createClient();
  const report = await loadReport(supabase, reportId);
  if (!report || report.status !== "draft")
    return { status: "error", message: "This report is not a draft." };
  const exercise = await loadEndedExercise(supabase, report.exercise_id);
  if (!exercise) return { status: "error", message: "The exercise has not ended." };
  if (report.content.narrative.origin === "template") {
    return {
      status: "error",
      message: "The narrative is still the template. Regenerate or edit it before finalizing.",
    };
  }

  const facts = buildReportFacts(context.org, exercise, report.content.cover.facilitator);
  const content = reportContentSchema.parse({ ...facts, narrative: report.content.narrative });
  const generatedAt = new Date();
  const fingerprint = contentFingerprint(content);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /^https?:\/\//,
    "",
  );

  let pdf: Buffer;
  try {
    pdf = await renderReportPdf({
      content,
      reportId: report.id,
      version: report.version,
      generatedAt,
      fingerprint,
      siteUrl,
    });
  } catch (error) {
    console.error("[report] render failed:", error);
    return { status: "error", message: "The PDF could not be rendered." };
  }
  const sha256 = sha256Hex(pdf);
  const path = reportPdfPath(context.org.id, exercise.id, report.version);

  try {
    await uploadReportPdf(path, pdf);
  } catch (error) {
    console.error("[report] upload failed:", error);
    return {
      status: "error",
      message:
        error instanceof StorageUnavailableError ? error.message : "The PDF could not be stored.",
    };
  }

  const { error } = await supabase
    .from("reports")
    .update({
      status: "final",
      content: content as unknown as Json,
      pdf_path: path,
      sha256,
      generated_at: generatedAt.toISOString(),
      finalized_at: generatedAt.toISOString(),
    })
    .eq("id", report.id)
    .eq("status", "draft");
  if (error) {
    console.error("[report] finalize update failed:", error.message);
    return { status: "error", message: "The report row could not be finalized." };
  }

  if (exercise.status === "ended") {
    const { error: statusError } = await supabase
      .from("exercises")
      .update({ status: "reported" })
      .eq("id", exercise.id)
      .eq("status", "ended");
    if (statusError) console.error("[report] exercise status update failed:", statusError.message);
  }

  await logEvent(
    "report_finalized",
    {
      version: report.version,
      bytes: pdf.length,
      narrative_origin: report.content.narrative.origin,
    },
    getIpHash(await headers()),
    context.org.id,
  );
  revalidatePath(reportPath(exercise.id));
  revalidatePath(`/app/exercises/${exercise.id}`);
  revalidatePath("/app/evidence");
  redirect(reportPath(exercise.id, report.version));
}

/** Starts an amended draft from a final report; the final stays on file. */
export async function amendReportAction(formData: FormData): Promise<void> {
  const reportId = asString(formData.get("reportId"));
  const context = await requireContext();
  const supabase = await createClient();
  const report = await loadReport(supabase, reportId);
  if (!report || report.status !== "final") redirect("/app/evidence");
  const existing = await latestDraft(supabase, report.exercise_id);
  if (existing) redirect(reportPath(report.exercise_id, existing.version));

  const version = await nextReportVersion(supabase, report.exercise_id);
  const content: ReportContent = {
    ...report.content,
    narrative: { ...report.content.narrative, origin: "user" },
  };
  const { error } = await supabase.from("reports").insert({
    exercise_id: report.exercise_id,
    org_id: report.org_id,
    version,
    content: content as unknown as Json,
    created_by: context.user.id,
  });
  if (error) throw new Error(`Could not start the amended report: ${error.message}`);
  await logEvent(
    "report_amended",
    { from_version: report.version, version },
    getIpHash(await headers()),
    context.org.id,
  );
  redirect(reportPath(report.exercise_id, version));
}

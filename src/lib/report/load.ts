import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExerciseStatus } from "@/lib/schemas/exercise";
import { reportContentSchema, type ReportContent } from "@/lib/schemas/report";
import type { ScenarioType } from "@/lib/schemas/scenario";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type ReportStatus = "draft" | "final";

export type ReportSummary = {
  id: string;
  version: number;
  status: ReportStatus;
  sha256: string | null;
  pdf_path: string | null;
  generated_at: string;
  finalized_at: string | null;
  created_at: string;
};

export type ReportRecord = ReportSummary & {
  exercise_id: string;
  org_id: string;
  content: ReportContent;
};

/** Every report version of an exercise, newest first. */
export async function loadReports(supabase: Client, exerciseId: string): Promise<ReportSummary[]> {
  const { data, error } = await supabase
    .from("reports")
    .select("id, version, status, sha256, pdf_path, generated_at, finalized_at, created_at")
    .eq("exercise_id", exerciseId)
    .order("version", { ascending: false });
  if (error) throw new Error(`Could not load reports: ${error.message}`);
  return (data ?? []).map((row) => ({ ...row, status: row.status as ReportStatus }));
}

export async function loadReport(supabase: Client, reportId: string): Promise<ReportRecord | null> {
  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, exercise_id, org_id, version, status, sha256, pdf_path, generated_at, finalized_at, created_at, content",
    )
    .eq("id", reportId)
    .maybeSingle();
  if (error) throw new Error(`Could not load the report: ${error.message}`);
  if (!data) return null;
  const content = reportContentSchema.safeParse(data.content);
  if (!content.success) throw new Error(`Report ${reportId} has unreadable content`);
  return { ...data, status: data.status as ReportStatus, content: content.data };
}

export async function nextReportVersion(supabase: Client, exerciseId: string): Promise<number> {
  const { data, error } = await supabase
    .from("reports")
    .select("version")
    .eq("exercise_id", exerciseId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not read report versions: ${error.message}`);
  return (data?.version ?? 0) + 1;
}

export type EvidenceRow = {
  id: string;
  title: string;
  status: ExerciseStatus;
  started_at: string | null;
  ended_at: string | null;
  scenario: { title: string; type: ScenarioType; is_pack: boolean };
  participants: { total: number; attended: number; signedOff: number };
  plan_version: number | null;
  report: { id: string; version: number; sha256: string; finalized_at: string } | null;
};

export type Evidence = {
  exercises: EvidenceRow[];
  approvedPlan: {
    id: string;
    version: number;
    approved_by_name: string;
    approved_at: string;
  } | null;
  /** The most recent ended exercise, which the next-test-due rule counts from. */
  lastEndedAt: string | null;
};

/** Everything the evidence vault shows (SPEC.md section 7, Phase 4). */
export async function loadEvidence(supabase: Client, orgId: string): Promise<Evidence> {
  const [exercises, plan] = await Promise.all([
    supabase
      .from("exercises")
      .select(
        "id, title, status, started_at, ended_at, scenarios(title, type, is_pack), ir_plans(version), exercise_participants(attended_at, signed_off_at), reports(id, version, status, sha256, finalized_at)",
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("ir_plans")
      .select("id, version, approved_by_name, approved_at")
      .eq("org_id", orgId)
      .eq("status", "approved")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (exercises.error) throw new Error(`Could not load evidence: ${exercises.error.message}`);
  if (plan.error) throw new Error(`Could not load the approved plan: ${plan.error.message}`);

  const rows: EvidenceRow[] = (exercises.data ?? []).map((row) => {
    const finals = row.reports
      .filter((r) => r.status === "final" && r.sha256 && r.finalized_at)
      .sort((a, b) => b.version - a.version);
    const latest = finals[0];
    return {
      id: row.id,
      title: row.title,
      status: row.status as ExerciseStatus,
      started_at: row.started_at,
      ended_at: row.ended_at,
      scenario: { ...row.scenarios, type: row.scenarios.type as ScenarioType },
      participants: {
        total: row.exercise_participants.length,
        attended: row.exercise_participants.filter((p) => p.attended_at).length,
        signedOff: row.exercise_participants.filter((p) => p.signed_off_at).length,
      },
      plan_version: row.ir_plans?.version ?? null,
      report: latest
        ? {
            id: latest.id,
            version: latest.version,
            sha256: latest.sha256!,
            finalized_at: latest.finalized_at!,
          }
        : null,
    };
  });
  const lastEndedAt =
    rows
      .filter((r) => r.ended_at)
      .map((r) => r.ended_at!)
      .sort()
      .at(-1) ?? null;

  return {
    exercises: rows,
    approvedPlan: plan.data
      ? {
          id: plan.data.id,
          version: plan.data.version,
          approved_by_name: plan.data.approved_by_name!,
          approved_at: plan.data.approved_at!,
        }
      : null,
    lastEndedAt,
  };
}

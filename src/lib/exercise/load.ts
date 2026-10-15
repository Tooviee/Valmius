import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { scenarioSchema, type Scenario, type ScenarioType } from "@/lib/schemas/scenario";
import type { ExerciseStatus, FindingKind, Severity } from "@/lib/schemas/exercise";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type ExerciseSummary = {
  id: string;
  title: string;
  status: ExerciseStatus;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  scenario: { id: string; title: string; type: ScenarioType; is_pack: boolean };
  participants: { total: number; attended: number; signedOff: number };
};

export type Participant = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  token: string;
  attended_at: string | null;
  signed_off_at: string | null;
  signature_name: string | null;
};

export type DecisionEntry = {
  id: string;
  inject_index: number | null;
  logged_at: string;
  actor_name: string;
  decision: string;
  notes: string;
};

export type Finding = {
  id: string;
  kind: FindingKind;
  description: string;
  severity: Severity | null;
  owner_name: string | null;
  due_date: string | null;
  created_at: string;
};

export type ExerciseRecord = {
  id: string;
  org_id: string;
  title: string;
  status: ExerciseStatus;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  revealed_count: number;
  reveal_times: string[];
  parking_lot: string;
  facilitator_id: string | null;
  scenario: { id: string; type: ScenarioType; is_pack: boolean; content: Scenario };
  plan: { id: string; version: number; status: "draft" | "approved" } | null;
  participants: Participant[];
  decisions: DecisionEntry[];
  findings: Finding[];
};

export type PackOption = { id: string; type: ScenarioType; title: string; summary: string };

/** Every exercise of the organization, newest first, with roster counts. */
export async function loadExercises(supabase: Client, orgId: string): Promise<ExerciseSummary[]> {
  const { data, error } = await supabase
    .from("exercises")
    .select(
      "id, title, status, scheduled_at, started_at, ended_at, created_at, scenarios(id, title, type, is_pack), exercise_participants(attended_at, signed_off_at)",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load exercises: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status as ExerciseStatus,
    scheduled_at: row.scheduled_at,
    started_at: row.started_at,
    ended_at: row.ended_at,
    created_at: row.created_at,
    scenario: { ...row.scenarios, type: row.scenarios.type as ScenarioType },
    participants: {
      total: row.exercise_participants.length,
      attended: row.exercise_participants.filter((p) => p.attended_at).length,
      signedOff: row.exercise_participants.filter((p) => p.signed_off_at).length,
    },
  }));
}

/** One exercise with its scenario, roster, log and findings. RLS scopes it to the member's org. */
export async function loadExercise(supabase: Client, id: string): Promise<ExerciseRecord | null> {
  const { data, error } = await supabase
    .from("exercises")
    .select(
      "id, org_id, title, status, scheduled_at, started_at, ended_at, created_at, revealed_count, reveal_times, parking_lot, facilitator_id, scenarios(id, type, is_pack, content), ir_plans(id, version, status), exercise_participants(id, name, email, role, token, attended_at, signed_off_at, signature_name, created_at), decision_log(id, inject_index, logged_at, actor_name, decision, notes), findings(id, kind, description, severity, owner_name, due_date, created_at)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load the exercise: ${error.message}`);
  if (!data) return null;

  const content = scenarioSchema.safeParse(data.scenarios.content);
  if (!content.success) throw new Error(`Scenario ${data.scenarios.id} has unreadable content`);
  const byTime =
    <T extends { [k: string]: unknown }>(key: keyof T) =>
    (a: T, b: T) =>
      String(a[key]).localeCompare(String(b[key]));

  return {
    id: data.id,
    org_id: data.org_id,
    title: data.title,
    status: data.status as ExerciseStatus,
    scheduled_at: data.scheduled_at,
    started_at: data.started_at,
    ended_at: data.ended_at,
    created_at: data.created_at,
    revealed_count: data.revealed_count,
    reveal_times: data.reveal_times,
    parking_lot: data.parking_lot,
    facilitator_id: data.facilitator_id,
    scenario: {
      id: data.scenarios.id,
      type: data.scenarios.type as ScenarioType,
      is_pack: data.scenarios.is_pack,
      content: content.data,
    },
    plan: data.ir_plans
      ? {
          id: data.ir_plans.id,
          version: data.ir_plans.version,
          status: data.ir_plans.status as "draft" | "approved",
        }
      : null,
    participants: [...data.exercise_participants].sort(byTime("created_at")).map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      role: p.role,
      token: p.token,
      attended_at: p.attended_at,
      signed_off_at: p.signed_off_at,
      signature_name: p.signature_name,
    })),
    decisions: [...data.decision_log].sort(byTime("logged_at")),
    findings: [...data.findings].sort(byTime("created_at")).map((f) => ({
      ...f,
      kind: f.kind as FindingKind,
      severity: f.severity as Severity | null,
    })),
  };
}

/** The twelve seeded packs, for the create form. */
export async function loadPacks(supabase: Client): Promise<PackOption[]> {
  const { data, error } = await supabase
    .from("scenarios")
    .select("id, type, title, content")
    .eq("is_pack", true)
    .is("org_id", null)
    .order("type")
    .order("title");
  if (error) throw new Error(`Could not load scenario packs: ${error.message}`);
  return (data ?? []).map((row) => {
    const content = row.content as { summary?: string } | null;
    return {
      id: row.id,
      type: row.type as ScenarioType,
      title: row.title,
      summary: typeof content?.summary === "string" ? content.summary : "",
    };
  });
}

/** The plan version an exercise tests: the latest approved one, else the latest draft, else none. */
export async function loadPlanForExercise(
  supabase: Client,
  orgId: string,
): Promise<{ id: string; version: number; status: "draft" | "approved" } | null> {
  const { data, error } = await supabase
    .from("ir_plans")
    .select("id, version, status")
    .eq("org_id", orgId)
    .order("status", { ascending: true }) // "approved" sorts before "draft"
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load the plan: ${error.message}`);
  return data ? { ...data, status: data.status as "draft" | "approved" } : null;
}

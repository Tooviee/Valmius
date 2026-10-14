import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Organization } from "@/lib/auth/session";
import { planSectionsSchema, type PlanSections } from "@/lib/schemas/plan";
import { questionnaireAnswersSchema } from "@/lib/schemas/questionnaire";
import type { Database } from "@/lib/supabase/database.types";
import { buildPlanFacts, type PlanFacts } from "./facts";

type Client = SupabaseClient<Database>;

export type PlanSummary = {
  id: string;
  version: number;
  status: "draft" | "approved";
  approved_by_name: string | null;
  approved_at: string | null;
  created_at: string;
};

export type PlanRecord = PlanSummary & { questionnaire_id: string; sections: PlanSections };

/** The completed questionnaire turned into plan facts, or null if it is not complete yet. */
export async function loadPlanFacts(
  supabase: Client,
  org: Organization,
): Promise<{ facts: PlanFacts; questionnaireId: string } | null> {
  const { data, error } = await supabase
    .from("questionnaires")
    .select("id, answers, completed_at")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load the questionnaire: ${error.message}`);
  if (!data?.completed_at) return null;
  const answers = questionnaireAnswersSchema.safeParse(data.answers);
  if (!answers.success) return null;
  return { facts: buildPlanFacts(org, answers.data), questionnaireId: data.id };
}

/** Every version of the organization's plan, newest first, without the section text. */
export async function loadPlanVersions(supabase: Client, orgId: string): Promise<PlanSummary[]> {
  const { data, error } = await supabase
    .from("ir_plans")
    .select("id, version, status, approved_by_name, approved_at, created_at")
    .eq("org_id", orgId)
    .order("version", { ascending: false });
  if (error) throw new Error(`Could not load plan versions: ${error.message}`);
  return (data ?? []).map((row) => ({ ...row, status: row.status as PlanSummary["status"] }));
}

/** One plan version with its sections. RLS already limits this to the user's organization. */
export async function loadPlan(supabase: Client, planId: string): Promise<PlanRecord | null> {
  const { data, error } = await supabase
    .from("ir_plans")
    .select(
      "id, version, status, approved_by_name, approved_at, created_at, questionnaire_id, sections",
    )
    .eq("id", planId)
    .maybeSingle();
  if (error) throw new Error(`Could not load the plan: ${error.message}`);
  if (!data) return null;
  const sections = planSectionsSchema.safeParse(data.sections);
  if (!sections.success) throw new Error(`Plan ${planId} has unreadable sections`);
  return { ...data, status: data.status as PlanSummary["status"], sections: sections.data };
}

export async function nextPlanVersion(supabase: Client, orgId: string): Promise<number> {
  const { data, error } = await supabase
    .from("ir_plans")
    .select("version")
    .eq("org_id", orgId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not read plan versions: ${error.message}`);
  return (data?.version ?? 0) + 1;
}

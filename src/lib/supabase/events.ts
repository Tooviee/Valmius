import "server-only";
import { getAdminClient } from "./admin";
import type { Json } from "./database.types";

export type EventName =
  | "generator_viewed"
  | "scenario_generated"
  | "generator_rate_limited"
  | "email_submitted"
  | "pdf_downloaded"
  | "login_link_requested"
  | "login_link_failed"
  | "org_created"
  | "questionnaire_completed"
  | "plan_section_generated"
  | "plan_generated"
  | "plan_saved"
  | "plan_approved"
  | "plan_exported"
  | "exercise_scenario_generated"
  | "exercise_created"
  | "exercise_started"
  | "inject_revealed"
  | "decision_logged"
  | "finding_added"
  | "exercise_ended"
  | "participant_attended"
  | "participant_signed_off"
  | "report_generated"
  | "report_finalized"
  | "report_amended"
  | "report_downloaded"
  | "evidence_exported";

export type EventProperties = { [key: string]: Json | undefined };

/**
 * Records a product event in `events`. It never throws: a logging failure must not
 * break the visitor's request. Do not put email addresses or free text in `properties`.
 */
export async function logEvent(
  name: EventName,
  properties: EventProperties,
  ipHash: string | null,
  orgId: string | null = null,
): Promise<void> {
  try {
    const { error } = await getAdminClient()
      .from("events")
      .insert({ name, properties, ip_hash: ipHash, org_id: orgId });
    if (error) console.error(`[events] could not log ${name}: ${error.message}`);
  } catch (error) {
    console.error(`[events] could not log ${name}:`, error);
  }
}

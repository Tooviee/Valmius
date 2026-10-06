import "server-only";
import { getAdminClient } from "./admin";
import type { Json } from "./database.types";

export type EventName =
  | "generator_viewed"
  | "scenario_generated"
  | "generator_rate_limited"
  | "email_submitted"
  | "pdf_downloaded";

export type EventProperties = { [key: string]: Json | undefined };

/**
 * Records a product event in `events`. It never throws: a logging failure must not
 * break the visitor's request. Do not put email addresses or free text in `properties`.
 */
export async function logEvent(
  name: EventName,
  properties: EventProperties,
  ipHash: string | null,
): Promise<void> {
  try {
    const { error } = await getAdminClient()
      .from("events")
      .insert({ name, properties, ip_hash: ipHash });
    if (error) console.error(`[events] could not log ${name}: ${error.message}`);
  } catch (error) {
    console.error(`[events] could not log ${name}:`, error);
  }
}

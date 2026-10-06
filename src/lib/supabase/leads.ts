import "server-only";
import { getAdminClient } from "./admin";

const UNIQUE_VIOLATION = "23505";

export type LeadSource = "generator" | "landing";

export type NewLead = {
  email: string;
  source: LeadSource;
  industry?: string;
  headcount_band?: string;
  scenario_type?: string;
};

/**
 * Stores an email capture. `leads` has a unique index on lower(email), so an address
 * that is already there is reported as "duplicate" and the first row is kept.
 */
export async function saveLead(lead: NewLead): Promise<"saved" | "duplicate" | "failed"> {
  try {
    const { error } = await getAdminClient()
      .from("leads")
      .insert({ ...lead, email: lead.email.toLowerCase() });
    if (!error) return "saved";
    if (error.code === UNIQUE_VIOLATION) return "duplicate";
    console.error(`[leads] could not save lead: ${error.message}`);
    return "failed";
  } catch (error) {
    console.error("[leads] could not save lead:", error);
    return "failed";
  }
}

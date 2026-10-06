"use server";

import { headers } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import { getIpHash } from "@/lib/rate-limit/ip";
import { leadSchema } from "@/lib/schemas/lead";
import { logEvent } from "@/lib/supabase/events";
import { saveLead } from "@/lib/supabase/leads";
import type { LeadState } from "./types";

/** Stores an email capture and logs `email_submitted`. No email is sent (SPEC.md section 3). */
export async function submitLeadAction(
  _previous: LeadState,
  formData: FormData,
): Promise<LeadState> {
  const parsed = leadSchema.safeParse({
    email: formData.get("email"),
    source: formData.get("source"),
    industry: formData.get("industry"),
    headcountBand: formData.get("headcountBand"),
    scenarioType: formData.get("scenarioType"),
  });
  if (!parsed.success) return { status: "invalid" };

  const lead = parsed.data;
  const ipHash = getIpHash(await headers());
  if ((await checkRateLimit("lead", ipHash)) === "blocked") return { status: "rate_limited" };

  const outcome = await saveLead({
    email: lead.email,
    source: lead.source,
    industry: lead.industry,
    headcount_band: lead.headcountBand,
    scenario_type: lead.scenarioType,
  });
  if (outcome === "failed") return { status: "error" };

  await logEvent(
    "email_submitted",
    {
      source: lead.source,
      scenario_type: lead.scenarioType ?? null,
      returning: outcome === "duplicate",
    },
    ipHash,
  );

  return { status: "ok" };
}

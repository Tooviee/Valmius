"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getIpHash } from "@/lib/rate-limit/ip";
import { organizationInputSchema } from "@/lib/schemas/organization";
import { logEvent } from "@/lib/supabase/events";
import { createClient } from "@/lib/supabase/server";
import type { OrganizationField, OrganizationFormValues, OrganizationState } from "./types";

const FIELD_MESSAGES: Record<OrganizationField, string> = {
  name: "Enter your company name (up to 120 characters).",
  industry: "Choose an industry.",
  headcountBand: "Choose a company size.",
  frameworks: "Choose from the listed frameworks.",
  timezone: "Choose a time zone.",
};

const UNIQUE_VIOLATION = "23505";

const asString = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");

/** Creates the user's organization on first login (SPEC.md section 7, Phase 2). */
export async function createOrganizationAction(
  _previous: OrganizationState,
  formData: FormData,
): Promise<OrganizationState> {
  const values: OrganizationFormValues = {
    name: asString(formData.get("name")).slice(0, 500),
    industry: asString(formData.get("industry")),
    headcountBand: asString(formData.get("headcountBand")),
    frameworks: formData.getAll("frameworks").map(asString),
    timezone: asString(formData.get("timezone")).slice(0, 100),
  };

  const parsed = organizationInputSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<OrganizationField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && field in FIELD_MESSAGES) {
        fieldErrors[field as OrganizationField] = FIELD_MESSAGES[field as OrganizationField];
      }
    }
    return { status: "invalid", values, fieldErrors };
  }

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const input = parsed.data;
  const supabase = await createClient();
  // One transaction: the organization row plus the caller's owner membership.
  const { data: orgId, error } = await supabase.rpc("create_organization", {
    p_name: input.name,
    p_industry: input.industry,
    p_headcount_band: input.headcountBand,
    p_frameworks: input.frameworks,
    p_timezone: input.timezone,
  });

  // Already a member (for example, the form was submitted twice): just go to the app.
  if (error?.code === UNIQUE_VIOLATION) redirect("/app");
  if (error || !orgId) {
    console.error("[org] create_organization failed:", error?.message ?? "no id returned");
    return { status: "error", values };
  }

  await logEvent(
    "org_created",
    {
      industry: input.industry,
      headcount_band: input.headcountBand,
      frameworks: input.frameworks,
    },
    getIpHash(await headers()),
    orgId,
  );

  redirect("/app");
}

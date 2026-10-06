"use server";

import { headers } from "next/headers";
import { generateScenario, seededScenarioResult } from "@/lib/llm";
import { checkRateLimit } from "@/lib/rate-limit";
import { getIpHash } from "@/lib/rate-limit/ip";
import { generatorInputSchema } from "@/lib/schemas/generator";
import { logEvent } from "@/lib/supabase/events";
import type { GenerateState, GeneratorField, GeneratorFormValues } from "./types";

const FIELD_MESSAGES: Record<GeneratorField, string> = {
  industry: "Choose an industry.",
  headcountBand: "Choose a company size.",
  hosting: "Choose at least one place your systems run.",
  scenarioType: "Choose a scenario type.",
  context: "Keep the context under 500 characters.",
};

const asString = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");

/** Generates a scenario for the public generator form (SPEC.md section 7, Phase 1). */
export async function generateScenarioAction(
  _previous: GenerateState,
  formData: FormData,
): Promise<GenerateState> {
  const values: GeneratorFormValues = {
    industry: asString(formData.get("industry")),
    headcountBand: asString(formData.get("headcountBand")),
    hosting: formData.getAll("hosting").map(asString),
    scenarioType: asString(formData.get("scenarioType")),
    // Echo back at most what the form allows, however much was posted.
    context: asString(formData.get("context")).slice(0, 2000),
  };

  const parsed = generatorInputSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<GeneratorField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && field in FIELD_MESSAGES) {
        fieldErrors[field as GeneratorField] = FIELD_MESSAGES[field as GeneratorField];
      }
    }
    return { status: "invalid", values, fieldErrors };
  }

  const input = parsed.data;
  const ipHash = getIpHash(await headers());

  const limit = await checkRateLimit("generate", ipHash);
  if (limit === "blocked") {
    await logEvent("generator_rate_limited", { type: input.scenarioType }, ipHash);
    return { status: "rate_limited", values };
  }

  // If the limiter cannot be reached, spend nothing: serve a seeded scenario.
  const result =
    limit === "unavailable"
      ? seededScenarioResult(input, "rate_limiter_unavailable")
      : await generateScenario(input);

  await logEvent(
    "scenario_generated",
    {
      type: input.scenarioType,
      industry: input.industry,
      headcount_band: input.headcountBand,
      hosting: input.hosting,
      // The free text itself is not logged; it may describe the visitor's company.
      has_context: input.context.length > 0,
      ...result.meta,
    },
    ipHash,
  );

  return { status: "ok", values, scenario: result.scenario };
}

import "server-only";
import type { GeneratorInput } from "@/lib/schemas/generator";
import { generateScenarioWith, seededScenarioResult } from "./generate-scenario";
import type { GenerateScenarioResult, LlmProvider } from "./types";

export { seededScenarioResult } from "./generate-scenario";
export type { FallbackReason, GenerateScenarioResult, LlmCallMeta } from "./types";

let cached: { name: string; provider: LlmProvider } | undefined;

/**
 * Picks the implementation from LLM_PROVIDER: "anthropic" (real API) or "mock"
 * (fixtures from tests/fixtures/llm). Returns null for any other value.
 */
async function resolveProvider(): Promise<LlmProvider | null> {
  const name = process.env.LLM_PROVIDER;
  if (cached && cached.name === name) return cached.provider;

  let provider: LlmProvider;
  if (name === "anthropic") {
    provider = (await import("./providers/anthropic")).createAnthropicProvider();
  } else if (name === "mock") {
    provider = (await import("./providers/mock")).createMockProvider();
  } else {
    console.error(
      `[llm] LLM_PROVIDER must be "anthropic" or "mock" (got ${JSON.stringify(name)}). Serving seeded scenarios.`,
    );
    return null;
  }

  cached = { name, provider };
  return provider;
}

/**
 * Generates a tabletop scenario for the public generator. All LLM access in the app
 * goes through this module, and every response is validated with zod before it is
 * returned. On any failure the result is a seeded scenario, flagged in `meta`.
 */
export async function generateScenario(input: GeneratorInput): Promise<GenerateScenarioResult> {
  const provider = await resolveProvider();
  if (!provider) return seededScenarioResult(input, "config_error");
  return generateScenarioWith(provider, input);
}

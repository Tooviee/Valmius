import type { z } from "zod";
import type { GeneratorInput } from "@/lib/schemas/generator";
import { scenarioSchema, type PackScenarioType, type Scenario } from "@/lib/schemas/scenario";
import { pickSeededScenario } from "./fallback";
import { parseJsonResponse } from "./parse";
import { buildScenarioPrompt, withRetryFeedback } from "./prompts/scenario";
import {
  LlmCallError,
  LlmRefusalError,
  type FallbackReason,
  type GenerateScenarioResult,
  type LlmCompletion,
  type LlmProvider,
} from "./types";

// Thinking counts toward max_tokens, so this leaves room well beyond the ~4k tokens a scenario needs.
const MAX_TOKENS = 16_000;
// One call, plus one retry if the reply fails validation (SPEC.md section 4).
const MAX_ATTEMPTS = 2;
// Past this the visitor gets a seeded scenario instead of a timed-out request.
const TIME_BUDGET_MS = 110_000;
const MAX_ISSUES_IN_FEEDBACK = 8;

type Checked = { ok: true; scenario: Scenario } | { ok: false; problem: string };

function describeIssues(error: z.ZodError): string {
  const lines = error.issues
    .slice(0, MAX_ISSUES_IN_FEEDBACK)
    .map((issue) => `- ${issue.path.join(".") || "(top level)"}: ${issue.message}`);
  const more = error.issues.length - lines.length;
  if (more > 0) lines.push(`- and ${more} more`);
  return lines.join("\n");
}

function checkScenario(completion: LlmCompletion, expectedType: PackScenarioType): Checked {
  if (completion.truncated) {
    return { ok: false, problem: "- It was cut off before the JSON object was complete." };
  }
  const parsed = parseJsonResponse(completion.text);
  if (!parsed.ok) {
    return { ok: false, problem: "- It was not a valid JSON object." };
  }
  const result = scenarioSchema.safeParse(parsed.value);
  if (!result.success) {
    return { ok: false, problem: describeIssues(result.error) };
  }
  if (result.data.type !== expectedType) {
    return {
      ok: false,
      problem: `- type: was "${result.data.type}" but must be "${expectedType}".`,
    };
  }
  return { ok: true, scenario: result.data };
}

/** A seeded scenario returned without calling a model, for example when configuration is wrong. */
export function seededScenarioResult(
  input: GeneratorInput,
  reason: FallbackReason,
): GenerateScenarioResult {
  return {
    scenario: pickSeededScenario(input),
    meta: {
      model: "none",
      input_tokens: 0,
      output_tokens: 0,
      latency_ms: 0,
      attempts: 0,
      fallback_used: true,
      fallback_reason: reason,
      error_status: null,
    },
  };
}

/**
 * The generation pipeline shared by every provider: prompt, call, parse, validate,
 * one retry on invalid output, then the seeded fallback. It never throws for a model
 * or API failure; the visitor always gets a valid scenario.
 */
export async function generateScenarioWith(
  provider: LlmProvider,
  input: GeneratorInput,
): Promise<GenerateScenarioResult> {
  const startedAt = Date.now();
  const prompt = buildScenarioPrompt(input);
  const signal = AbortSignal.timeout(TIME_BUDGET_MS);

  let model = provider.model;
  let inputTokens = 0;
  let outputTokens = 0;
  let attempts = 0;
  let problem: string | null = null;
  let fallbackReason: FallbackReason = "invalid_output";
  let errorStatus: number | null = null;

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1;

    let completion: LlmCompletion;
    try {
      completion = await provider.complete({
        task: { kind: "scenario", scenarioType: input.scenarioType },
        system: prompt.system,
        user: problem ? withRetryFeedback(prompt.user, problem) : prompt.user,
        maxTokens: MAX_TOKENS,
        outputSchema: scenarioSchema,
        signal,
      });
    } catch (error) {
      // The SDK has already retried transient failures, so a thrown call goes straight
      // to the fallback rather than being retried again here.
      if (error instanceof LlmRefusalError) fallbackReason = "refusal";
      else if (signal.aborted) fallbackReason = "timeout";
      else fallbackReason = "api_error";
      errorStatus = error instanceof LlmCallError ? error.status : null;
      console.error(`[llm] ${provider.name} scenario call failed (${fallbackReason}):`, error);
      break;
    }

    model = completion.model;
    inputTokens += completion.usage.input_tokens;
    outputTokens += completion.usage.output_tokens;

    const checked = checkScenario(completion, input.scenarioType);
    if (checked.ok) {
      return {
        scenario: checked.scenario,
        meta: {
          model,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          latency_ms: Date.now() - startedAt,
          attempts,
          fallback_used: false,
          fallback_reason: null,
          error_status: null,
        },
      };
    }

    problem = checked.problem;
    console.warn(
      `[llm] ${provider.name} scenario reply failed validation (attempt ${attempts}):\n${problem}`,
    );
  }

  return {
    scenario: pickSeededScenario(input),
    meta: {
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      latency_ms: Date.now() - startedAt,
      attempts,
      fallback_used: true,
      fallback_reason: fallbackReason,
      error_status: errorStatus,
    },
  };
}

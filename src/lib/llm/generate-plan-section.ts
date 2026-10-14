import type { z } from "zod";
import type { PlanFacts } from "@/lib/plan/facts";
import { templateSection } from "@/lib/plan/templates";
import {
  planSectionMeta,
  planSectionOutputSchema,
  type PlanSection,
  type PlanSectionId,
} from "@/lib/schemas/plan";
import { parseJsonResponse } from "./parse";
import { buildPlanSectionPrompt } from "./prompts/plan";
import { withRetryFeedback } from "./prompts/scenario";
import {
  LlmCallError,
  LlmRefusalError,
  type FallbackReason,
  type GeneratePlanSectionResult,
  type LlmCompletion,
  type LlmProvider,
} from "./types";

export type ModelSectionId = Exclude<PlanSectionId, "notification_matrix">;

// A section is at most ~1,500 tokens of markdown; thinking counts toward this too.
const MAX_TOKENS = 8_000;
const MAX_ATTEMPTS = 2;
// Sections run several at a time; this keeps the whole plan inside the page's time limit.
const TIME_BUDGET_MS = 90_000;
const MAX_ISSUES_IN_FEEDBACK = 8;

type Checked = { ok: true; section: PlanSection } | { ok: false; problem: string };

function describeIssues(error: z.ZodError): string {
  const lines = error.issues
    .slice(0, MAX_ISSUES_IN_FEEDBACK)
    .map((issue) => `- ${issue.path.join(".") || "(top level)"}: ${issue.message}`);
  const more = error.issues.length - lines.length;
  if (more > 0) lines.push(`- and ${more} more`);
  return lines.join("\n");
}

function checkSection(completion: LlmCompletion, sectionId: ModelSectionId): Checked {
  if (completion.truncated) {
    return { ok: false, problem: "- It was cut off before the JSON object was complete." };
  }
  const parsed = parseJsonResponse(completion.text);
  if (!parsed.ok) return { ok: false, problem: "- It was not a valid JSON object." };
  const result = planSectionOutputSchema.safeParse(parsed.value);
  if (!result.success) return { ok: false, problem: describeIssues(result.error) };
  if (/^#\s|\n#\s/.test(result.data.markdown)) {
    return { ok: false, problem: "- markdown: must not contain a top-level '#' heading." };
  }
  return {
    ok: true,
    section: {
      id: sectionId,
      title: planSectionMeta(sectionId).title,
      markdown: result.data.markdown,
      framework_refs: result.data.framework_refs,
      origin: "model",
    },
  };
}

/** A template section returned without calling a model, for example on a config error. */
export function templateSectionResult(
  facts: PlanFacts,
  sectionId: ModelSectionId,
  reason: FallbackReason,
): GeneratePlanSectionResult {
  return {
    section: templateSection(sectionId, facts),
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
 * The per-section pipeline: prompt, call, parse, validate, one retry on invalid output,
 * then a template fallback flagged for review. Never throws for a model or API failure.
 */
export async function generatePlanSectionWith(
  provider: LlmProvider,
  facts: PlanFacts,
  sectionId: ModelSectionId,
): Promise<GeneratePlanSectionResult> {
  const startedAt = Date.now();
  const prompt = buildPlanSectionPrompt(facts, sectionId);
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
        task: { kind: "plan_section", sectionId },
        system: prompt.system,
        user: problem ? withRetryFeedback(prompt.user, problem) : prompt.user,
        maxTokens: MAX_TOKENS,
        outputSchema: planSectionOutputSchema,
        signal,
      });
    } catch (error) {
      if (error instanceof LlmRefusalError) fallbackReason = "refusal";
      else if (signal.aborted) fallbackReason = "timeout";
      else fallbackReason = "api_error";
      errorStatus = error instanceof LlmCallError ? error.status : null;
      console.error(
        `[llm] ${provider.name} plan section "${sectionId}" failed (${fallbackReason}):`,
        error,
      );
      break;
    }

    model = completion.model;
    inputTokens += completion.usage.input_tokens;
    outputTokens += completion.usage.output_tokens;

    const checked = checkSection(completion, sectionId);
    if (checked.ok) {
      return {
        section: checked.section,
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
      `[llm] ${provider.name} plan section "${sectionId}" failed validation (attempt ${attempts}):\n${problem}`,
    );
  }

  return {
    section: templateSection(sectionId, facts),
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

import type { z } from "zod";
import { templateNarrative, type ReportFacts } from "@/lib/report/build";
import {
  NARRATIVE_IDS,
  reportNarrativeOutputSchema,
  type ReportNarrative,
} from "@/lib/schemas/report";
import { parseJsonResponse } from "./parse";
import { buildReportPrompt } from "./prompts/report";
import { withRetryFeedback } from "./prompts/scenario";
import {
  LlmCallError,
  LlmRefusalError,
  type FallbackReason,
  type GenerateReportResult,
  type LlmCompletion,
  type LlmProvider,
} from "./types";

const MAX_TOKENS = 8_000;
const MAX_ATTEMPTS = 2;
const TIME_BUDGET_MS = 110_000;
const MAX_ISSUES_IN_FEEDBACK = 8;

type Checked = { ok: true; narrative: ReportNarrative } | { ok: false; problem: string };

function describeIssues(error: z.ZodError): string {
  const lines = error.issues
    .slice(0, MAX_ISSUES_IN_FEEDBACK)
    .map((issue) => `- ${issue.path.join(".") || "(top level)"}: ${issue.message}`);
  const more = error.issues.length - lines.length;
  if (more > 0) lines.push(`- and ${more} more`);
  return lines.join("\n");
}

function checkNarrative(completion: LlmCompletion): Checked {
  if (completion.truncated) {
    return { ok: false, problem: "- It was cut off before the JSON object was complete." };
  }
  const parsed = parseJsonResponse(completion.text);
  if (!parsed.ok) return { ok: false, problem: "- It was not a valid JSON object." };
  const result = reportNarrativeOutputSchema.safeParse(parsed.value);
  if (!result.success) return { ok: false, problem: describeIssues(result.error) };
  for (const id of NARRATIVE_IDS) {
    if (/^#\s|\n#\s/.test(result.data[id])) {
      return { ok: false, problem: `- ${id}: must not contain a top-level '#' heading.` };
    }
  }
  return {
    ok: true,
    narrative: {
      executive_summary: result.data.executive_summary.trim(),
      what_went_well: result.data.what_went_well.trim(),
      gap_analysis: result.data.gap_analysis.trim(),
      action_plan: result.data.action_plan.trim(),
      closing: result.data.closing.trim(),
      origin: "model",
    },
  };
}

export function templateReportResult(
  facts: ReportFacts,
  reason: FallbackReason,
): GenerateReportResult {
  return {
    narrative: templateNarrative(facts),
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

/** Prompt, call, parse, validate, one retry, then the template. Never throws for a model failure. */
export async function generateReportWith(
  provider: LlmProvider,
  facts: ReportFacts,
): Promise<GenerateReportResult> {
  const startedAt = Date.now();
  const prompt = buildReportPrompt(facts);
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
        task: { kind: "report" },
        system: prompt.system,
        user: problem ? withRetryFeedback(prompt.user, problem) : prompt.user,
        maxTokens: MAX_TOKENS,
        outputSchema: reportNarrativeOutputSchema,
        signal,
      });
    } catch (error) {
      if (error instanceof LlmRefusalError) fallbackReason = "refusal";
      else if (signal.aborted) fallbackReason = "timeout";
      else fallbackReason = "api_error";
      errorStatus = error instanceof LlmCallError ? error.status : null;
      console.error(`[llm] ${provider.name} report call failed (${fallbackReason}):`, error);
      break;
    }

    model = completion.model;
    inputTokens += completion.usage.input_tokens;
    outputTokens += completion.usage.output_tokens;

    const checked = checkNarrative(completion);
    if (checked.ok) {
      return {
        narrative: checked.narrative,
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
      `[llm] ${provider.name} report reply failed validation (attempt ${attempts}):\n${problem}`,
    );
  }

  return {
    narrative: templateNarrative(facts),
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

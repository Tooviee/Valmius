import type { z } from "zod";
import type { PlanSection, PlanSectionId } from "@/lib/schemas/plan";
import type { PackScenarioType, Scenario } from "@/lib/schemas/scenario";

export type LlmProviderName = "anthropic" | "mock";

export type LlmUsage = {
  input_tokens: number;
  output_tokens: number;
};

/** What is being generated. The mock provider uses it to pick a fixture. */
export type LlmTask =
  | { kind: "scenario"; scenarioType: PackScenarioType }
  | { kind: "plan_section"; sectionId: Exclude<PlanSectionId, "notification_matrix"> };

export type LlmRequest = {
  task: LlmTask;
  system: string;
  user: string;
  maxTokens: number;
  /** The JSON shape the response must have. Providers that can constrain output use it. */
  outputSchema: z.ZodType;
  signal?: AbortSignal;
};

export type LlmCompletion = {
  /** Raw response text. The caller parses and validates it. */
  text: string;
  /** The model that produced the response. */
  model: string;
  usage: LlmUsage;
  /** True when the response was cut off by the max_tokens limit. */
  truncated: boolean;
};

export interface LlmProvider {
  readonly name: LlmProviderName;
  /** The model this provider is configured to call. */
  readonly model: string;
  complete(request: LlmRequest): Promise<LlmCompletion>;
}

/** A provider call that failed. `status` is the HTTP status when the API answered with an error. */
export class LlmCallError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null, options?: ErrorOptions) {
    super(message, options);
    this.name = "LlmCallError";
    this.status = status;
  }
}

/** The model declined the request (`stop_reason: "refusal"`). */
export class LlmRefusalError extends Error {
  readonly category: string | null;

  constructor(category: string | null) {
    super(`The model declined the request${category ? ` (category: ${category})` : ""}`);
    this.name = "LlmRefusalError";
    this.category = category;
  }
}

export type FallbackReason =
  | "invalid_output"
  | "api_error"
  | "refusal"
  | "timeout"
  | "config_error"
  | "rate_limiter_unavailable";

/** Logged to `events` for every generation (SPEC.md section 10). */
export type LlmCallMeta = {
  model: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  attempts: number;
  fallback_used: boolean;
  fallback_reason: FallbackReason | null;
  error_status: number | null;
};

export type GenerateScenarioResult = {
  scenario: Scenario;
  meta: LlmCallMeta;
};

export type GeneratePlanSectionResult = {
  section: PlanSection;
  meta: LlmCallMeta;
};

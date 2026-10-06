import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { LlmCallError, LlmRefusalError, type LlmProvider } from "../types";

export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5-5";

// Server-side refusal fallback (beta). If the model's safety classifiers decline a
// request in the security category, the API retries it on another model inside the
// same call. Incident scenarios are security content, so this keeps a false positive
// from costing the visitor a tailored scenario. To turn it off, drop `betas` and
// `fallbacks` from the request below.
const REFUSAL_FALLBACK_BETA = "server-side-fallback-2026-07-01";

// Thinking is always on for claude-sonnet-5-5; effort is the control. "low" is the
// suggested starting point for content generation and keeps the wait short.
const EFFORT = "low";

export function createAnthropicProvider(): LlmProvider {
  let client: Anthropic | undefined;
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;

  return {
    name: "anthropic",
    model,
    async complete(request) {
      // No explicit key: credentials resolve from the environment (SPEC.md section 4).
      client ??= new Anthropic();

      let response;
      try {
        response = await client.beta.messages.create(
          {
            model,
            max_tokens: request.maxTokens,
            system: request.system,
            messages: [{ role: "user", content: request.user }],
            // No temperature: claude-sonnet-5-5 rejects non-default sampling parameters.
            output_config: {
              effort: EFFORT,
              // Constrains the reply to the schema's shape. The API does not enforce
              // array sizes or number ranges, so the caller still validates with zod.
              format: {
                type: "json_schema",
                schema: zodOutputFormat(request.outputSchema).schema,
              },
            },
            betas: [REFUSAL_FALLBACK_BETA],
            fallbacks: "default",
          },
          { signal: request.signal, maxRetries: 1 },
        );
      } catch (error) {
        if (error instanceof Anthropic.APIError) {
          // HTTP errors carry a status; connection failures and timeouts do not.
          throw new LlmCallError(error.message, error.status ?? null, { cause: error });
        }
        throw error;
      }

      // A refusal is an HTTP 200 whose content is empty or partial.
      if (response.stop_reason === "refusal") {
        throw new LlmRefusalError(response.stop_details?.category ?? null);
      }

      // The response can start with a thinking block, so read text blocks by type.
      const text = response.content
        .flatMap((block) => (block.type === "text" ? [block.text] : []))
        .join("");

      return {
        text,
        model: response.model,
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        },
        truncated: response.stop_reason === "max_tokens",
      };
    },
  };
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateScenarioWith } from "@/lib/llm/generate-scenario";
import { SEEDED_PACKS } from "@/lib/llm/packs";
import { createAnthropicProvider } from "@/lib/llm/providers/anthropic";
import { describeCompany, generatorInputSchema } from "@/lib/schemas/generator";
import { scenarioSchema } from "@/lib/schemas/scenario";
import ransomwareFixture from "../fixtures/llm/scenario-ransomware.json";

// The real provider's behaviour is tested against a stubbed SDK. No test may reach
// the live API (SPEC.md section 12); tests/setup.ts blocks the network as a backstop.
const sdk = vi.hoisted(() => {
  class APIError extends Error {
    status: number | undefined;
    constructor(status: number | undefined, message: string) {
      super(message);
      this.status = status;
    }
  }
  return { create: vi.fn(), constructorArgs: [] as unknown[][], APIError };
});

vi.mock("@anthropic-ai/sdk", () => {
  class Anthropic {
    static APIError = sdk.APIError;
    beta = { messages: { create: sdk.create } };
    constructor(...args: unknown[]) {
      sdk.constructorArgs.push(args);
    }
  }
  return { default: Anthropic };
});

const input = generatorInputSchema.parse({
  industry: "healthcare",
  headcountBand: "51-200",
  hosting: ["on_prem", "azure"],
  scenarioType: "ransomware",
  context: "Two clinics share one file server.",
});

const validScenario = scenarioSchema.parse(ransomwareFixture);

type FakeResponse = {
  text?: string;
  content?: unknown[];
  stop_reason?: string;
  stop_details?: { category: string | null } | null;
  model?: string;
  usage?: { input_tokens: number; output_tokens: number };
};

function response({
  text = JSON.stringify(validScenario),
  content,
  stop_reason = "end_turn",
  stop_details = null,
  model = "claude-sonnet-5-5",
  usage = { input_tokens: 1200, output_tokens: 3400 },
}: FakeResponse = {}) {
  return {
    content: content ?? [{ type: "text", text }],
    stop_reason,
    stop_details,
    model,
    usage,
  };
}

const run = () => generateScenarioWith(createAnthropicProvider(), input);

beforeEach(() => {
  sdk.create.mockReset();
  sdk.constructorArgs.length = 0;
  vi.stubEnv("ANTHROPIC_MODEL", "claude-sonnet-5-5");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("anthropic provider: request", () => {
  it("constructs the client with no explicit key and sends a bounded, schema-constrained request", async () => {
    sdk.create.mockResolvedValueOnce(response());

    await run();

    expect(sdk.constructorArgs).toEqual([[]]);
    expect(sdk.create).toHaveBeenCalledOnce();
    const [params, options] = sdk.create.mock.calls[0]!;
    expect(params.model).toBe("claude-sonnet-5-5");
    expect(params.max_tokens).toBe(16_000);
    expect(params).not.toHaveProperty("temperature");
    expect(params.output_config.effort).toBe("low");
    expect(params.output_config.format.type).toBe("json_schema");
    expect(params.output_config.format.schema.type).toBe("object");
    expect(params.output_config.format.schema.additionalProperties).toBe(false);
    expect(Object.keys(params.output_config.format.schema.properties)).toContain("injects");
    expect(params.fallbacks).toBe("default");
    expect(params.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(params.messages).toHaveLength(1);
    expect(params.messages[0].role).toBe("user");
    expect(params.messages[0].content).toContain("Scenario type: ransomware");
    expect(params.system).toContain("tabletop exercise");
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("takes the model from ANTHROPIC_MODEL and defaults to claude-sonnet-5-5", async () => {
    vi.stubEnv("ANTHROPIC_MODEL", "claude-test-model");
    sdk.create.mockResolvedValueOnce(response());
    await run();
    expect(sdk.create.mock.calls[0]![0].model).toBe("claude-test-model");

    vi.stubEnv("ANTHROPIC_MODEL", "");
    sdk.create.mockResolvedValueOnce(response());
    await run();
    expect(sdk.create.mock.calls[1]![0].model).toBe("claude-sonnet-5-5");
  });
});

describe("anthropic provider: parsing", () => {
  it("returns the validated scenario with the model and token usage", async () => {
    sdk.create.mockResolvedValueOnce(response());

    const { scenario, meta } = await run();

    expect(scenario).toEqual(validScenario);
    expect(meta).toMatchObject({
      model: "claude-sonnet-5-5",
      input_tokens: 1200,
      output_tokens: 3400,
      attempts: 1,
      fallback_used: false,
      fallback_reason: null,
      error_status: null,
    });
    expect(meta.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it("reads text blocks by type when the response starts with a thinking block", async () => {
    sdk.create.mockResolvedValueOnce(
      response({
        content: [
          { type: "thinking", thinking: "", signature: "sig" },
          { type: "text", text: JSON.stringify(validScenario) },
        ],
      }),
    );

    const { scenario, meta } = await run();

    expect(scenario).toEqual(validScenario);
    expect(meta.fallback_used).toBe(false);
  });

  it("accepts JSON wrapped in a Markdown code fence", async () => {
    sdk.create.mockResolvedValueOnce(
      response({ text: `\`\`\`json\n${JSON.stringify(validScenario, null, 2)}\n\`\`\`` }),
    );

    const { scenario, meta } = await run();

    expect(scenario).toEqual(validScenario);
    expect(meta.attempts).toBe(1);
  });

  it("reports the model that actually served the request", async () => {
    sdk.create.mockResolvedValueOnce(response({ model: "claude-sonnet-5" }));
    const { meta } = await run();
    expect(meta.model).toBe("claude-sonnet-5");
  });
});

describe("anthropic provider: retry then fallback", () => {
  const tooFewInjects = JSON.stringify({
    ...validScenario,
    injects: validScenario.injects.slice(0, 4),
  });

  it("retries once with the validation errors, then succeeds", async () => {
    sdk.create
      .mockResolvedValueOnce(
        response({ text: tooFewInjects, usage: { input_tokens: 1000, output_tokens: 2000 } }),
      )
      .mockResolvedValueOnce(response({ usage: { input_tokens: 1100, output_tokens: 3000 } }));

    const { scenario, meta } = await run();

    expect(sdk.create).toHaveBeenCalledTimes(2);
    const retryPrompt = sdk.create.mock.calls[1]![0].messages[0].content as string;
    expect(retryPrompt).toContain("Your previous reply could not be used");
    expect(retryPrompt).toContain("injects");
    expect(scenario).toEqual(validScenario);
    expect(meta).toMatchObject({
      attempts: 2,
      input_tokens: 2100,
      output_tokens: 5000,
      fallback_used: false,
    });
  });

  it("falls back to a seeded scenario after two invalid replies, without a third call", async () => {
    sdk.create.mockResolvedValue(response({ text: tooFewInjects }));

    const { scenario, meta } = await run();

    expect(sdk.create).toHaveBeenCalledTimes(2);
    expect(meta).toMatchObject({
      attempts: 2,
      fallback_used: true,
      fallback_reason: "invalid_output",
      input_tokens: 2400,
      output_tokens: 6800,
    });
    expect(scenarioSchema.safeParse(scenario).success).toBe(true);
    expect(scenario.type).toBe("ransomware");
    expect(SEEDED_PACKS.map((pack) => pack.scenario.title)).toContain(scenario.title);
    expect(scenario.setting.company_profile).toBe(describeCompany(input));
  });

  it("falls back when the reply is not JSON twice", async () => {
    sdk.create.mockResolvedValue(response({ text: "I'm sorry, I can't produce that scenario." }));

    const { meta } = await run();

    expect(sdk.create).toHaveBeenCalledTimes(2);
    expect(meta).toMatchObject({ fallback_used: true, fallback_reason: "invalid_output" });
  });

  it("retries when the reply has the wrong scenario type", async () => {
    sdk.create
      .mockResolvedValueOnce(response({ text: JSON.stringify({ ...validScenario, type: "bec" }) }))
      .mockResolvedValueOnce(response());

    const { scenario, meta } = await run();

    expect(sdk.create.mock.calls[1]![0].messages[0].content).toContain('must be "ransomware"');
    expect(scenario.type).toBe("ransomware");
    expect(meta.attempts).toBe(2);
  });

  it("retries when the reply was cut off by max_tokens", async () => {
    sdk.create
      .mockResolvedValueOnce(
        response({ text: JSON.stringify(validScenario).slice(0, 400), stop_reason: "max_tokens" }),
      )
      .mockResolvedValueOnce(response());

    const { meta } = await run();

    expect(sdk.create.mock.calls[1]![0].messages[0].content).toContain("cut off");
    expect(meta).toMatchObject({ attempts: 2, fallback_used: false });
  });

  it("falls back immediately when the API call fails", async () => {
    sdk.create.mockRejectedValueOnce(new sdk.APIError(529, "Overloaded"));

    const { scenario, meta } = await run();

    expect(sdk.create).toHaveBeenCalledOnce();
    expect(meta).toMatchObject({
      model: "claude-sonnet-5-5",
      attempts: 1,
      input_tokens: 0,
      output_tokens: 0,
      fallback_used: true,
      fallback_reason: "api_error",
      error_status: 529,
    });
    expect(scenarioSchema.safeParse(scenario).success).toBe(true);
  });

  it("falls back on a connection failure, which has no status", async () => {
    sdk.create.mockRejectedValueOnce(new sdk.APIError(undefined, "Connection error."));

    const { meta } = await run();

    expect(meta).toMatchObject({
      fallback_used: true,
      fallback_reason: "api_error",
      error_status: null,
    });
  });

  it("falls back immediately when the model declines the request", async () => {
    sdk.create.mockResolvedValueOnce(
      response({ content: [], stop_reason: "refusal", stop_details: { category: "cyber" } }),
    );

    const { scenario, meta } = await run();

    expect(sdk.create).toHaveBeenCalledOnce();
    expect(meta).toMatchObject({
      attempts: 1,
      fallback_used: true,
      fallback_reason: "refusal",
    });
    expect(scenario.type).toBe("ransomware");
  });
});

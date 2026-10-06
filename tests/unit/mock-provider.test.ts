import { afterEach, describe, expect, it, vi } from "vitest";
import { generateScenario } from "@/lib/llm";
import { createMockProvider } from "@/lib/llm/providers/mock";
import { generatorInputSchema, type GeneratorInput } from "@/lib/schemas/generator";
import { PACK_SCENARIO_TYPES, scenarioSchema } from "@/lib/schemas/scenario";
import becFixture from "../fixtures/llm/scenario-bec.json";
import cloudCredentialFixture from "../fixtures/llm/scenario-cloud-credential.json";
import ransomwareFixture from "../fixtures/llm/scenario-ransomware.json";
import vendorBreachFixture from "../fixtures/llm/scenario-vendor-breach.json";

const fixtures = {
  ransomware: ransomwareFixture,
  bec: becFixture,
  cloud_credential: cloudCredentialFixture,
  vendor_breach: vendorBreachFixture,
};

const inputFor = (scenarioType: GeneratorInput["scenarioType"]): GeneratorInput =>
  generatorInputSchema.parse({
    industry: "saas_software",
    headcountBand: "11-50",
    hosting: ["aws"],
    scenarioType,
  });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("mock provider", () => {
  it.each(PACK_SCENARIO_TYPES)("has a %s fixture that passes the scenario schema", (type) => {
    const result = scenarioSchema.safeParse(fixtures[type]);
    expect(result.success).toBe(true);
    expect(result.data?.type).toBe(type);
    // The Playwright smoke test expects at least 4 injects on the page.
    expect(result.data?.injects.length).toBeGreaterThanOrEqual(5);
  });

  it.each(PACK_SCENARIO_TYPES)("returns the %s fixture as raw JSON text", async (type) => {
    const completion = await createMockProvider().complete({
      task: { kind: "scenario", scenarioType: type },
      system: "",
      user: "",
      maxTokens: 1,
      outputSchema: scenarioSchema,
    });

    expect(JSON.parse(completion.text)).toEqual(fixtures[type]);
    expect(completion.model).toBe("mock");
    expect(completion.usage).toEqual({ input_tokens: 0, output_tokens: 0 });
  });

  it.each(PACK_SCENARIO_TYPES)(
    "generateScenario serves the %s fixture through the shared pipeline",
    async (type) => {
      const { scenario, meta } = await generateScenario(inputFor(type));

      expect(scenario).toEqual(scenarioSchema.parse(fixtures[type]));
      expect(meta).toMatchObject({
        model: "mock",
        input_tokens: 0,
        output_tokens: 0,
        attempts: 1,
        fallback_used: false,
        fallback_reason: null,
      });
    },
  );
});

describe("provider selection", () => {
  it("serves a seeded scenario and reports a config error for an unknown LLM_PROVIDER", async () => {
    vi.stubEnv("LLM_PROVIDER", "openai");
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const { scenario, meta } = await generateScenario(inputFor("bec"));

    expect(scenarioSchema.safeParse(scenario).success).toBe(true);
    expect(scenario.type).toBe("bec");
    expect(meta).toMatchObject({
      model: "none",
      attempts: 0,
      fallback_used: true,
      fallback_reason: "config_error",
    });
    expect(logged).toHaveBeenCalledOnce();
  });
});

import { describe, expect, it, vi } from "vitest";
import { generatePlanSection } from "@/lib/llm";
import { generatePlanSectionWith } from "@/lib/llm/generate-plan-section";
import { createMockProvider } from "@/lib/llm/providers/mock";
import { LlmCallError, type LlmCompletion, type LlmProvider } from "@/lib/llm/types";
import { buildPlanFacts } from "@/lib/plan/facts";
import { MODEL_SECTION_IDS, planSectionSchema } from "@/lib/schemas/plan";
import { questionnaireAnswersSchema } from "@/lib/schemas/questionnaire";
import fixtures from "../fixtures/llm/plan-sections.json";
import answersFixture from "../fixtures/questionnaire-answers.json";

const facts = buildPlanFacts(
  {
    name: "Alpha Clinic",
    industry: "healthcare",
    headcount_band: "11-50",
    timezone: "America/New_York",
    frameworks: ["hipaa", "soc2"],
  },
  questionnaireAnswersSchema.parse(answersFixture),
);

const completion = (text: string, extra: Partial<LlmCompletion> = {}): LlmCompletion => ({
  text,
  model: "stub-model",
  usage: { input_tokens: 100, output_tokens: 50 },
  truncated: false,
  ...extra,
});

function stubProvider(responses: Array<LlmCompletion | Error>): LlmProvider & {
  complete: ReturnType<typeof vi.fn>;
} {
  const complete = vi.fn();
  for (const response of responses) {
    if (response instanceof Error) complete.mockRejectedValueOnce(response);
    else complete.mockResolvedValueOnce(response);
  }
  return { name: "anthropic", model: "stub-model", complete };
}

describe("generatePlanSection with the mock provider", () => {
  it.each(MODEL_SECTION_IDS)("returns the %s fixture through the shared pipeline", async (id) => {
    const { section, meta } = await generatePlanSection(facts, id);
    expect(section.id).toBe(id);
    expect(section.markdown).toBe(fixtures[id].markdown);
    expect(section.origin).toBe("model");
    expect(planSectionSchema.safeParse(section).success).toBe(true);
    expect(meta).toMatchObject({ model: "mock", attempts: 1, fallback_used: false });
  });

  it("the mock provider answers plan tasks with the section fixture", async () => {
    const result = await createMockProvider().complete({
      task: { kind: "plan_section", sectionId: "roles" },
      system: "",
      user: "",
      maxTokens: 1,
      outputSchema: planSectionSchema,
    });
    expect(JSON.parse(result.text)).toEqual(fixtures.roles);
  });
});

describe("generatePlanSectionWith retry and fallback", () => {
  const valid = JSON.stringify(fixtures.purpose);

  it("retries once after invalid output and sums the token usage", async () => {
    const provider = stubProvider([completion("not json"), completion(valid)]);
    const { section, meta } = await generatePlanSectionWith(provider, facts, "purpose");
    expect(section.origin).toBe("model");
    expect(provider.complete).toHaveBeenCalledTimes(2);
    expect(provider.complete.mock.calls[1][0].user).toContain("could not be used");
    expect(meta).toMatchObject({ attempts: 2, input_tokens: 200, output_tokens: 100 });
  });

  it("falls back to a flagged template after two invalid replies", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const provider = stubProvider([
      completion(
        JSON.stringify({ markdown: "# Heading\n\n" + "x".repeat(300), framework_refs: [] }),
      ),
      completion(valid, { truncated: true }),
    ]);
    const { section, meta } = await generatePlanSectionWith(provider, facts, "purpose");
    expect(section.origin).toBe("template");
    expect(section.markdown).toContain("Alpha Clinic");
    expect(meta).toMatchObject({
      attempts: 2,
      fallback_used: true,
      fallback_reason: "invalid_output",
    });
    warn.mockRestore();
  });

  it("falls back without retrying when the API call throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const provider = stubProvider([new LlmCallError("overloaded", 529)]);
    const { section, meta } = await generatePlanSectionWith(provider, facts, "lifecycle");
    expect(section.origin).toBe("template");
    expect(provider.complete).toHaveBeenCalledTimes(1);
    expect(meta).toMatchObject({
      attempts: 1,
      fallback_used: true,
      fallback_reason: "api_error",
      error_status: 529,
    });
    error.mockRestore();
  });

  it("passes the section task and the output schema to the provider", async () => {
    const provider = stubProvider([completion(valid)]);
    await generatePlanSectionWith(provider, facts, "purpose");
    const request = provider.complete.mock.calls[0][0];
    expect(request.task).toEqual({ kind: "plan_section", sectionId: "purpose" });
    expect(request.maxTokens).toBeGreaterThan(1000);
    expect(request.system).toContain("incident response (IR) plan");
  });
});

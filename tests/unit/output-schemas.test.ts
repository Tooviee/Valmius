import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { describe, expect, it } from "vitest";
import { planSectionOutputSchema } from "@/lib/schemas/plan";
import { scenarioSchema } from "@/lib/schemas/scenario";

// The Anthropic provider sends each output schema as a JSON schema for constrained output.
// zod transforms, trims and refinements cannot be represented there and make every real
// call fail (the mock provider never notices). This runs offline: no client, no request.
describe("LLM output schemas are JSON-schema representable", () => {
  it.each([
    ["scenario", scenarioSchema],
    ["plan section", planSectionOutputSchema],
  ])("%s", (_name, schema) => {
    const format = zodOutputFormat(schema);
    expect(format.type).toBe("json_schema");
    expect(format.schema).toMatchObject({ type: "object" });
  });
});

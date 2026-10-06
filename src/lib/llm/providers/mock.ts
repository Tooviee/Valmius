import type { PackScenarioType } from "@/lib/schemas/scenario";
import becFixture from "../../../../tests/fixtures/llm/scenario-bec.json";
import cloudCredentialFixture from "../../../../tests/fixtures/llm/scenario-cloud-credential.json";
import ransomwareFixture from "../../../../tests/fixtures/llm/scenario-ransomware.json";
import vendorBreachFixture from "../../../../tests/fixtures/llm/scenario-vendor-breach.json";
import type { LlmProvider } from "../types";

const SCENARIO_FIXTURES: Record<PackScenarioType, unknown> = {
  ransomware: ransomwareFixture,
  bec: becFixture,
  cloud_credential: cloudCredentialFixture,
  vendor_breach: vendorBreachFixture,
};

/**
 * Returns fixtures instead of calling an API. The fixture goes back as raw JSON text,
 * so it passes through the same parsing and zod validation as a real response.
 */
export function createMockProvider(): LlmProvider {
  return {
    name: "mock",
    model: "mock",
    async complete(request) {
      return {
        text: JSON.stringify(SCENARIO_FIXTURES[request.task.scenarioType]),
        model: "mock",
        usage: { input_tokens: 0, output_tokens: 0 },
        truncated: false,
      };
    },
  };
}

import type { PackScenarioType } from "@/lib/schemas/scenario";
import planSectionFixtures from "../../../../tests/fixtures/llm/plan-sections.json";
import reportFixture from "../../../../tests/fixtures/llm/report.json";
import becFixture from "../../../../tests/fixtures/llm/scenario-bec.json";
import cloudCredentialFixture from "../../../../tests/fixtures/llm/scenario-cloud-credential.json";
import ransomwareFixture from "../../../../tests/fixtures/llm/scenario-ransomware.json";
import vendorBreachFixture from "../../../../tests/fixtures/llm/scenario-vendor-breach.json";
import type { LlmProvider, LlmRequest } from "../types";

const SCENARIO_FIXTURES: Record<PackScenarioType, unknown> = {
  ransomware: ransomwareFixture,
  bec: becFixture,
  cloud_credential: cloudCredentialFixture,
  vendor_breach: vendorBreachFixture,
};

const PLAN_SECTION_FIXTURES: Record<string, unknown> = planSectionFixtures;

function fixtureFor(task: LlmRequest["task"]): unknown {
  switch (task.kind) {
    case "scenario":
      return SCENARIO_FIXTURES[task.scenarioType];
    case "plan_section":
      return PLAN_SECTION_FIXTURES[task.sectionId];
    case "report":
      return reportFixture;
  }
}

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
        text: JSON.stringify(fixtureFor(request.task)),
        model: "mock",
        usage: { input_tokens: 0, output_tokens: 0 },
        truncated: false,
      };
    },
  };
}

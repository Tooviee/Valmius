import { describe, expect, it } from "vitest";
import { SEEDED_PACKS, VARIANT_PROFILES } from "@/lib/llm/packs";
import { PACK_SCENARIO_TYPES, scenarioSchema } from "@/lib/schemas/scenario";

const validScenario = () => structuredClone(SEEDED_PACKS[0]!.scenario);

describe("scenario schema", () => {
  it("has three seeded variants for each of the four pack types", () => {
    expect(SEEDED_PACKS).toHaveLength(12);
    for (const type of PACK_SCENARIO_TYPES) {
      const variants = SEEDED_PACKS.filter((pack) => pack.type === type).map((p) => p.variant);
      expect(variants.sort()).toEqual(Object.keys(VARIANT_PROFILES).sort());
    }
  });

  it.each(SEEDED_PACKS.map((pack) => [pack.slug, pack] as const))(
    "accepts seeded pack %s",
    (_slug, pack) => {
      const result = scenarioSchema.safeParse(pack.scenario);
      expect(result.success).toBe(true);
      expect(pack.scenario.type).toBe(pack.type);
    },
  );

  it("rejects a scenario missing injects", () => {
    const withoutInjects: Partial<ReturnType<typeof validScenario>> = validScenario();
    delete withoutInjects.injects;
    const result = scenarioSchema.safeParse(withoutInjects);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain("injects");
  });

  it("rejects fewer than 5 or more than 7 injects", () => {
    const scenario = validScenario();
    const tooFew = { ...scenario, injects: scenario.injects.slice(0, 4) };
    const tooMany = { ...scenario, injects: Array(8).fill(scenario.injects[0]) };
    expect(scenarioSchema.safeParse(tooFew).success).toBe(false);
    expect(scenarioSchema.safeParse(tooMany).success).toBe(false);
  });

  it("rejects an inject with only one question", () => {
    const scenario = validScenario();
    scenario.injects[0]!.questions = scenario.injects[0]!.questions.slice(0, 1);
    expect(scenarioSchema.safeParse(scenario).success).toBe(false);
  });

  it("rejects a duration outside 45 to 120 minutes", () => {
    const scenario = validScenario();
    expect(scenarioSchema.safeParse({ ...scenario, estimated_duration_minutes: 30 }).success).toBe(
      false,
    );
    expect(scenarioSchema.safeParse({ ...scenario, estimated_duration_minutes: 180 }).success).toBe(
      false,
    );
  });

  it("rejects an unknown scenario type and an unknown framework reference", () => {
    const scenario = validScenario();
    expect(scenarioSchema.safeParse({ ...scenario, type: "phishing" }).success).toBe(false);

    const withBadRef = structuredClone(scenario) as { injects: { framework_refs: string[] }[] };
    withBadRef.injects[0]!.framework_refs = ["SOC 2 compliant"];
    expect(scenarioSchema.safeParse(withBadRef).success).toBe(false);
  });

  it("rejects fewer than 3 roles, objectives or wrap-up questions", () => {
    const scenario = validScenario();
    expect(
      scenarioSchema.safeParse({ ...scenario, roles: scenario.roles.slice(0, 2) }).success,
    ).toBe(false);
    expect(
      scenarioSchema.safeParse({ ...scenario, objectives: scenario.objectives.slice(0, 2) })
        .success,
    ).toBe(false);
    expect(
      scenarioSchema.safeParse({
        ...scenario,
        wrap_up_questions: scenario.wrap_up_questions.slice(0, 2),
      }).success,
    ).toBe(false);
  });
});

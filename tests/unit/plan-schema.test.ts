import { describe, expect, it } from "vitest";
import { buildNotificationMatrixSection } from "@/lib/plan/notification-matrix";
import {
  MODEL_SECTION_IDS,
  PLAN_SECTION_IDS,
  PLAN_SECTIONS,
  planSectionOutputSchema,
  planSectionsSchema,
  planSectionMeta,
  type PlanSection,
} from "@/lib/schemas/plan";
import fixtures from "../fixtures/llm/plan-sections.json";

const fixtureSections = (): PlanSection[] =>
  PLAN_SECTION_IDS.map((id) => {
    if (id === "notification_matrix") {
      return buildNotificationMatrixSection({
        companyName: "Alpha Clinic",
        frameworks: ["hipaa"],
        dataTypes: [],
        regulatoryObligations: ["hipaa"],
        owners: { legal: "COO", executive: "CEO", communications: "Comms", technical: "IT" },
      });
    }
    const output = planSectionOutputSchema.parse(fixtures[id]);
    return { id, title: planSectionMeta(id).title, ...output, origin: "model" };
  });

describe("plan section schemas", () => {
  it("has 11 outline sections, 10 of which the model writes", () => {
    expect(PLAN_SECTIONS).toHaveLength(11);
    expect(PLAN_SECTION_IDS).toHaveLength(11);
    expect(MODEL_SECTION_IDS).toHaveLength(10);
    expect(MODEL_SECTION_IDS).not.toContain("notification_matrix");
  });

  it.each(MODEL_SECTION_IDS)("the %s fixture passes the model output schema", (id) => {
    const result = planSectionOutputSchema.safeParse(fixtures[id]);
    expect(result.success).toBe(true);
    expect(result.data?.framework_refs.length).toBeGreaterThan(0);
    expect(result.data?.markdown).not.toMatch(/^# /m);
  });

  it("accepts the 11 sections in outline order", () => {
    expect(planSectionsSchema.safeParse(fixtureSections()).success).toBe(true);
  });

  it("rejects a plan missing a section, out of order, or with an unknown framework ref", () => {
    const sections = fixtureSections();
    expect(planSectionsSchema.safeParse(sections.slice(0, 10)).success).toBe(false);
    expect(planSectionsSchema.safeParse([...sections].reverse()).success).toBe(false);
    const badRef = sections.map((s) => ({ ...s, framework_refs: ["SOC 2 CC9.9"] }));
    expect(planSectionsSchema.safeParse(badRef).success).toBe(false);
  });

  it("rejects model output that is too short to be a real section", () => {
    expect(
      planSectionOutputSchema.safeParse({ markdown: "Too short.", framework_refs: [] }).success,
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { formDataToObject } from "@/lib/forms/form-data";
import {
  ARRAY_FIELDS,
  isStepComplete,
  QUESTIONNAIRE_STEPS,
  questionnaireAnswersSchema,
  questionnaireDraftSchema,
  STEP_FIELDS,
  stepDraftSchema,
  stepSchema,
} from "@/lib/schemas/questionnaire";
import fixture from "../fixtures/questionnaire-answers.json";

describe("questionnaire answers schema", () => {
  it("accepts the fixture answers", () => {
    const result = questionnaireAnswersSchema.safeParse(fixture);
    expect(result.success).toBe(true);
    expect(result.data?.hosting).toEqual(["aws", "saas_only"]);
    // Empty optional strings are allowed and kept as empty.
    expect(result.data?.roles.it_security_lead.name).toBe("");
  });

  it("rejects a questionnaire missing a required role title", () => {
    const broken = structuredClone(fixture) as Record<string, unknown>;
    (broken.roles as Record<string, { title: string }>).legal.title = "";
    const result = questionnaireAnswersSchema.safeParse(broken);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["roles", "legal", "title"]);
  });

  it("caps free text at 1,000 characters", () => {
    const result = questionnaireAnswersSchema.safeParse({
      ...fixture,
      key_systems: "x".repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown enum values and empty required lists", () => {
    expect(questionnaireAnswersSchema.safeParse({ ...fixture, mfa_status: "maybe" }).success).toBe(
      false,
    );
    expect(
      questionnaireAnswersSchema.safeParse({ ...fixture, regulatory_obligations: [] }).success,
    ).toBe(false);
  });

  it("every answer key belongs to exactly one step", () => {
    const owned = Object.values(STEP_FIELDS).flat();
    const keys = Object.keys(questionnaireAnswersSchema.shape);
    expect([...owned].sort()).toEqual([...keys].sort());
  });
});

describe("drafts and steps", () => {
  it("the draft schema accepts an empty object and partial nested answers", () => {
    expect(questionnaireDraftSchema.safeParse({}).success).toBe(true);
    const partial = questionnaireDraftSchema.safeParse({
      roles: { legal: { name: "Pat" } },
      backups: { location: "S3" },
      hosting: ["aws", "aws"],
    });
    expect(partial.success).toBe(true);
    expect(partial.data?.hosting).toEqual(["aws"]);
  });

  it("the strict step schema fails on a half-finished step while the draft passes", () => {
    const half = { monitoring: ["none"], backups: { location: "Backblaze" } };
    expect(stepDraftSchema(4).safeParse(half).success).toBe(true);
    expect(stepSchema(4).safeParse(half).success).toBe(false);
  });

  it("isStepComplete tracks the fixture per step", () => {
    for (const { step } of QUESTIONNAIRE_STEPS) {
      expect(isStepComplete(step, fixture), `step ${step}`).toBe(true);
    }
    expect(isStepComplete(3, { ...fixture, roles: undefined })).toBe(false);
  });
});

describe("formDataToObject", () => {
  it("builds nested objects, arrays for checkbox groups and drops empty strings", () => {
    const formData = new FormData();
    formData.append("roles.legal.title", "General Counsel");
    formData.append("roles.legal.name", "  ");
    formData.append("hosting", "aws");
    formData.append("hosting", "gcp");
    formData.append("$ACTION_ID", "ignored");

    expect(formDataToObject(formData, ARRAY_FIELDS)).toEqual({
      roles: { legal: { title: "General Counsel", name: undefined } },
      hosting: ["aws", "gcp"],
    });
  });
});

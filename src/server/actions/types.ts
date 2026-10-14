import type { Scenario } from "@/lib/schemas/scenario";

/** The generator form as submitted, echoed back so the form keeps the visitor's choices. */
export type GeneratorFormValues = {
  industry: string;
  headcountBand: string;
  hosting: string[];
  scenarioType: string;
  context: string;
};

export type GeneratorField = keyof GeneratorFormValues;

export type GenerateState =
  | { status: "idle" }
  | {
      status: "invalid";
      values: GeneratorFormValues;
      fieldErrors: Partial<Record<GeneratorField, string>>;
    }
  | { status: "rate_limited"; values: GeneratorFormValues }
  | { status: "ok"; values: GeneratorFormValues; scenario: Scenario };

export type LeadState =
  | { status: "idle" }
  | { status: "invalid" }
  | { status: "rate_limited" }
  | { status: "error" }
  | { status: "ok" };

export type LoginState = {
  status: "idle" | "invalid" | "rate_limited" | "error" | "sent";
};

/** The onboarding form as submitted, echoed back on a validation error. */
export type OrganizationFormValues = {
  name: string;
  industry: string;
  headcountBand: string;
  frameworks: string[];
  timezone: string;
};

export type OrganizationField = keyof OrganizationFormValues;

export type OrganizationState =
  | { status: "idle" }
  | {
      status: "invalid";
      values: OrganizationFormValues;
      fieldErrors: Partial<Record<OrganizationField, string>>;
    }
  | { status: "error"; values: OrganizationFormValues };

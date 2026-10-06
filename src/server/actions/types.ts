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

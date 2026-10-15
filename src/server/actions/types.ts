import type { PlanSection } from "@/lib/schemas/plan";
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

export type QuestionnaireState =
  | { status: "idle" }
  | { status: "saved"; savedAt: string }
  | { status: "invalid"; fieldErrors: Record<string, string>; savedAt: string | null }
  | { status: "error" };

export type GeneratePlanState = { status: "idle" | "rate_limited" | "error" };

export type RegenerateSectionState =
  | { status: "idle" }
  | { status: "rate_limited" }
  | { status: "error" }
  | { status: "ok"; section: PlanSection };

export type SavePlanState = { status: "idle" | "invalid" | "error" };

export type ApprovePlanState = {
  status: "idle" | "invalid" | "needs_review" | "already_approved" | "error";
};

export type CreateExerciseValues = {
  title: string;
  scheduledAt: string;
  sourceKind: "pack" | "generate";
  packId: string;
  scenarioType: string;
  focus: string;
  participants: { name: string; email: string; role: string }[];
};

export type CreateExerciseState =
  | { status: "idle" }
  | { status: "invalid"; values: CreateExerciseValues; fieldErrors: Record<string, string> }
  | { status: "rate_limited"; values: CreateExerciseValues }
  | { status: "error"; values: CreateExerciseValues; message?: string };

export type ConsoleFormState =
  | { status: "idle" }
  | { status: "ok"; savedAt: string }
  | { status: "invalid"; fieldErrors: Record<string, string> }
  | { status: "error"; message: string };

export type ParkingLotState =
  { status: "idle" } | { status: "saved"; savedAt: string } | { status: "error" };

export type ParticipantActionState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "invalid"; message: string }
  | { status: "invalid_link" }
  | { status: "rate_limited" }
  | { status: "error" };

export type GenerateReportState = { status: "idle" | "rate_limited" | "error" | "not_ended" };

export type SaveReportState =
  | { status: "idle" }
  | { status: "saved"; savedAt: string }
  | { status: "invalid"; fieldErrors: Record<string, string> }
  | { status: "error" };

export type FinalizeReportState = { status: "idle" } | { status: "error"; message: string };

import { z } from "zod";
import { packScenarioTypeSchema } from "./scenario";

export const EXERCISE_STATUSES = ["scheduled", "live", "ended", "reported"] as const;
export type ExerciseStatus = (typeof EXERCISE_STATUSES)[number];
export const EXERCISE_STATUS_LABELS: Record<ExerciseStatus, string> = {
  scheduled: "Scheduled",
  live: "Live",
  ended: "Ended",
  reported: "Reported",
};

export const FINDING_KINDS = ["strength", "gap", "action_item"] as const;
export type FindingKind = (typeof FINDING_KINDS)[number];
export const FINDING_KIND_LABELS: Record<FindingKind, string> = {
  strength: "Strength",
  gap: "Gap",
  action_item: "Action item",
};

export const SEVERITIES = ["low", "medium", "high"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const MAX_PARTICIPANTS = 12;
export const FOCUS_MAX_LENGTH = 500;
export const DECISION_MAX_LENGTH = 2000;
export const PARKING_LOT_MAX_LENGTH = 5000;

/** The name used in the log for a decision the whole group made. */
export const TEAM_ACTOR = "Team";

const shortText = (max: number) => z.string().trim().min(1).max(max);

export const participantInputSchema = z.object({
  name: shortText(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email().max(254))
    .optional()
    .or(z.literal("").transform(() => undefined)),
  role: shortText(120),
});
export type ParticipantInput = z.infer<typeof participantInputSchema>;

/** Where the exercise's scenario comes from: a seeded pack, or the model with plan context. */
export const scenarioSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pack"), scenarioId: z.uuid() }),
  z.object({
    kind: z.literal("generate"),
    scenarioType: packScenarioTypeSchema,
    focus: z.string().trim().max(FOCUS_MAX_LENGTH).default(""),
  }),
]);
export type ScenarioSource = z.infer<typeof scenarioSourceSchema>;

export const createExerciseSchema = z.object({
  title: shortText(200),
  /** ISO 8601 instant, already converted from the org's time zone. */
  scheduledAt: z.iso.datetime({ offset: true }).optional(),
  source: scenarioSourceSchema,
  participants: z.array(participantInputSchema).max(MAX_PARTICIPANTS),
});
export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;

export const decisionEntrySchema = z.object({
  injectIndex: z.number().int().min(0).nullable(),
  actorName: shortText(120),
  decision: shortText(DECISION_MAX_LENGTH),
  notes: z.string().trim().max(DECISION_MAX_LENGTH).default(""),
});
export type DecisionEntryInput = z.infer<typeof decisionEntrySchema>;

export const findingInputSchema = z
  .object({
    kind: z.enum(FINDING_KINDS),
    description: shortText(DECISION_MAX_LENGTH),
    severity: z.enum(SEVERITIES).optional(),
    ownerName: z.string().trim().max(120).default(""),
    dueDate: z.iso.date().optional(),
  })
  .refine((f) => f.kind !== "gap" || f.severity !== undefined, {
    message: "Give the gap a severity.",
    path: ["severity"],
  });
export type FindingInput = z.infer<typeof findingInputSchema>;

export const signOffSchema = z.object({
  signatureName: shortText(120),
});

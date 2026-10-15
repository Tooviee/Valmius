import { z } from "zod";
import { FRAMEWORK_REFS } from "./frameworks";
import { SEVERITIES } from "./exercise";

/**
 * The after-action report (SPEC.md section 8.4). Everything factual is assembled from the
 * database; the model writes only the narrative sections below.
 */

export const REPORT_NARRATIVE_SECTIONS = [
  { id: "executive_summary", title: "Executive summary" },
  { id: "what_went_well", title: "What went well" },
  { id: "gap_analysis", title: "Gaps and risks" },
  { id: "action_plan", title: "Action plan" },
  { id: "closing", title: "Facilitator's closing note" },
] as const;
export const NARRATIVE_IDS = [
  "executive_summary",
  "what_went_well",
  "gap_analysis",
  "action_plan",
  "closing",
] as const satisfies readonly (typeof REPORT_NARRATIVE_SECTIONS)[number]["id"][];
export type NarrativeId = (typeof NARRATIVE_IDS)[number];

export const NARRATIVE_MAX_LENGTH = 8000;

/**
 * What the model returns. No transforms or trims: the provider turns this into a JSON
 * schema for constrained output; cleanup happens in the generator after parsing.
 */
export const reportNarrativeOutputSchema = z.object({
  executive_summary: z.string().min(150).max(NARRATIVE_MAX_LENGTH),
  what_went_well: z.string().min(80).max(NARRATIVE_MAX_LENGTH),
  gap_analysis: z.string().min(80).max(NARRATIVE_MAX_LENGTH),
  action_plan: z.string().min(80).max(NARRATIVE_MAX_LENGTH),
  closing: z.string().min(40).max(NARRATIVE_MAX_LENGTH),
});
export type ReportNarrativeOutput = z.infer<typeof reportNarrativeOutputSchema>;

export const NARRATIVE_ORIGINS = ["model", "template", "user"] as const;

export const reportNarrativeSchema = z.object({
  executive_summary: z.string().trim().min(1).max(NARRATIVE_MAX_LENGTH),
  what_went_well: z.string().trim().min(1).max(NARRATIVE_MAX_LENGTH),
  gap_analysis: z.string().trim().min(1).max(NARRATIVE_MAX_LENGTH),
  action_plan: z.string().trim().min(1).max(NARRATIVE_MAX_LENGTH),
  closing: z.string().trim().min(1).max(NARRATIVE_MAX_LENGTH),
  origin: z.enum(NARRATIVE_ORIGINS),
});
export type ReportNarrative = z.infer<typeof reportNarrativeSchema>;

const text = (max: number) => z.string().max(max);
const iso = z.string().max(40);

/** The stored `reports.content`: facts snapshot plus narrative, exactly what the PDF renders. */
export const reportContentSchema = z.object({
  cover: z.object({
    org_name: text(120),
    exercise_title: text(200),
    scenario_title: text(200),
    scenario_type: text(40),
    scenario_from_plan: z.boolean(),
    started_at: iso.nullable(),
    ended_at: iso.nullable(),
    duration_minutes: z.number().int().min(0).nullable(),
    facilitator: text(254),
    plan_version: z.number().int().min(1).nullable(),
    plan_status: z.enum(["draft", "approved"]).nullable(),
    timezone: text(64),
    frameworks: z.array(text(60)).max(16),
  }),
  participants: z
    .array(
      z.object({
        name: text(120),
        role: text(120),
        attended_at: iso.nullable(),
        signed_off_at: iso.nullable(),
        signature_name: text(120).nullable(),
      }),
    )
    .max(12),
  injects_used: z
    .array(
      z.object({
        index: z.number().int().min(0),
        title: text(200),
        offset_minutes: z.number().int().min(0),
        revealed_at: iso.nullable(),
      }),
    )
    .max(20),
  scenario_summary: text(2000),
  timeline: z
    .array(
      z.object({
        logged_at: iso,
        inject_index: z.number().int().min(0).nullable(),
        actor_name: text(120),
        decision: text(2000),
        notes: text(2000),
      }),
    )
    .max(500),
  strengths: z.array(z.object({ description: text(2000) })).max(100),
  gaps: z
    .array(z.object({ description: text(2000), severity: z.enum(SEVERITIES).nullable() }))
    .max(100),
  action_items: z
    .array(
      z.object({
        description: text(2000),
        owner_name: text(120).nullable(),
        due_date: text(20).nullable(),
      }),
    )
    .max(100),
  parking_lot: text(5000),
  control_mapping: z.array(z.object({ ref: z.enum(FRAMEWORK_REFS), summary: text(300) })).max(16),
  narrative: reportNarrativeSchema,
});
export type ReportContent = z.infer<typeof reportContentSchema>;

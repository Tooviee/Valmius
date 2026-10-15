import type { ExerciseRecord } from "@/lib/exercise/load";
import { FRAMEWORK_REF_SUMMARIES, type FrameworkRef } from "@/lib/schemas/frameworks";
import { FRAMEWORK_LABELS, type Framework } from "@/lib/schemas/organization";
import type { ReportContent, ReportNarrative } from "@/lib/schemas/report";
import { SCENARIO_TYPE_LABELS } from "@/lib/schemas/scenario";

/** The facts of an exercise, assembled in code (SPEC.md section 8.4). Never written by the model. */
export type ReportFacts = Omit<ReportContent, "narrative">;

export type ReportOrg = { name: string; timezone: string; frameworks: readonly string[] };

export function buildReportFacts(
  org: ReportOrg,
  exercise: ExerciseRecord,
  facilitator: string,
): ReportFacts {
  const scenario = exercise.scenario.content;
  const injectsUsed = scenario.injects.slice(0, exercise.revealed_count);
  const refs = new Set<FrameworkRef>();
  for (const inject of injectsUsed) for (const ref of inject.framework_refs) refs.add(ref);

  const duration =
    exercise.started_at && exercise.ended_at
      ? Math.max(
          0,
          Math.round(
            (new Date(exercise.ended_at).getTime() - new Date(exercise.started_at).getTime()) /
              60_000,
          ),
        )
      : null;

  return {
    cover: {
      org_name: org.name,
      exercise_title: exercise.title,
      scenario_title: scenario.title,
      scenario_type: SCENARIO_TYPE_LABELS[exercise.scenario.type],
      scenario_from_plan: !exercise.scenario.is_pack,
      started_at: exercise.started_at,
      ended_at: exercise.ended_at,
      duration_minutes: duration,
      facilitator,
      plan_version: exercise.plan?.version ?? null,
      plan_status: exercise.plan?.status ?? null,
      timezone: org.timezone,
      frameworks: org.frameworks.map((f) => FRAMEWORK_LABELS[f as Framework] ?? f),
    },
    participants: exercise.participants.map((p) => ({
      name: p.name,
      role: p.role,
      attended_at: p.attended_at,
      signed_off_at: p.signed_off_at,
      signature_name: p.signature_name,
    })),
    injects_used: injectsUsed.map((inject, position) => ({
      index: position,
      title: inject.title,
      offset_minutes: inject.offset_minutes,
      revealed_at: exercise.reveal_times[position] ?? null,
    })),
    scenario_summary: scenario.summary,
    timeline: exercise.decisions.map((d) => ({
      logged_at: d.logged_at,
      inject_index: d.inject_index,
      actor_name: d.actor_name,
      decision: d.decision,
      notes: d.notes,
    })),
    strengths: exercise.findings
      .filter((f) => f.kind === "strength")
      .map((f) => ({ description: f.description })),
    gaps: exercise.findings
      .filter((f) => f.kind === "gap")
      .map((f) => ({ description: f.description, severity: f.severity })),
    action_items: exercise.findings
      .filter((f) => f.kind === "action_item")
      .map((f) => ({ description: f.description, owner_name: f.owner_name, due_date: f.due_date })),
    parking_lot: exercise.parking_lot,
    control_mapping: [...refs].map((ref) => ({ ref, summary: FRAMEWORK_REF_SUMMARIES[ref] })),
  };
}

const fmt = (iso: string | null, timeZone: string) =>
  iso
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone,
      }).format(new Date(iso))
    : "not recorded";

const timeOnly = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", { timeStyle: "short", timeZone }).format(new Date(iso));

/** The facts as plain text for the model. Everything it may refer to is here. */
export function reportFactsToPromptText(facts: ReportFacts): string {
  const { cover } = facts;
  const tz = cover.timezone;
  const lines = [
    `Organization: ${cover.org_name}. Compliance obligations: ${cover.frameworks.join(", ") || "none listed"}.`,
    `Exercise: "${cover.exercise_title}", scenario "${cover.scenario_title}" (${cover.scenario_type}${cover.scenario_from_plan ? ", generated from the company's own plan" : ", a standard pack"}).`,
    `Started ${fmt(cover.started_at, tz)}; ended ${fmt(cover.ended_at, tz)}; duration ${cover.duration_minutes ?? "unknown"} minutes. Facilitator: ${cover.facilitator}.`,
    `Plan version tested: ${cover.plan_version ? `${cover.plan_version} (${cover.plan_status})` : "none attached"}.`,
    "",
    `Scenario summary: ${facts.scenario_summary}`,
    "",
    "Participants:",
    ...facts.participants.map(
      (p) =>
        `- ${p.name}, ${p.role}: ${p.attended_at ? "attended" : "did not attend"}; ${p.signed_off_at ? `signed off as ${p.signature_name}` : "not signed off"}.`,
    ),
    "",
    `Injects revealed (${facts.injects_used.length}):`,
    ...facts.injects_used.map(
      (i) =>
        `- Inject ${i.index + 1} (planned +${i.offset_minutes} min${i.revealed_at ? `, shown ${timeOnly(i.revealed_at, tz)}` : ""}): ${i.title}`,
    ),
    "",
    `Decision log (${facts.timeline.length} entries, server timestamps):`,
    ...facts.timeline.map(
      (t) =>
        `- ${timeOnly(t.logged_at, tz)} | ${t.inject_index === null ? "general" : `inject ${t.inject_index + 1}`} | ${t.actor_name}: ${t.decision}${t.notes ? ` (notes: ${t.notes})` : ""}`,
    ),
    "",
    `Strengths recorded (${facts.strengths.length}):`,
    ...facts.strengths.map((s) => `- ${s.description}`),
    `Gaps recorded (${facts.gaps.length}):`,
    ...facts.gaps.map((g) => `- [${g.severity ?? "unrated"}] ${g.description}`),
    `Action items recorded (${facts.action_items.length}):`,
    ...facts.action_items.map(
      (a) =>
        `- ${a.description}${a.owner_name ? ` (owner: ${a.owner_name})` : ""}${a.due_date ? ` (due ${a.due_date})` : ""}`,
    ),
    "",
    `Parking lot: ${facts.parking_lot || "empty"}`,
    "",
    "Controls this exercise gives evidence toward:",
    ...facts.control_mapping.map((c) => `- ${c.ref}: ${c.summary}`),
  ];
  return lines.join("\n");
}

const bullets = (items: string[], empty: string) =>
  items.length > 0 ? items.map((i) => `- ${i}`).join("\n") : `- ${empty}`;

/** Narrative built only from the facts, used when the model is unavailable. Flagged for review. */
export function templateNarrative(facts: ReportFacts): ReportNarrative {
  const { cover } = facts;
  const note =
    "> This section was filled from a template because the generator was unavailable. Regenerate or edit it before finalizing.\n\n";
  const attended = facts.participants.filter((p) => p.attended_at).length;
  return {
    origin: "template",
    executive_summary:
      note +
      `${cover.org_name} ran "${cover.exercise_title}", a ${cover.scenario_type.toLowerCase()} tabletop exercise${cover.plan_version ? ` against incident response plan version ${cover.plan_version}` : ""}, on ${fmt(cover.ended_at ?? cover.started_at, cover.timezone)}. ${attended} of ${facts.participants.length} invited participants attended, ${facts.injects_used.length} injects were revealed, and the group logged ${facts.timeline.length} decisions. The session recorded ${facts.strengths.length} strengths, ${facts.gaps.length} gaps and ${facts.action_items.length} action items.`,
    what_went_well:
      note +
      bullets(
        facts.strengths.map((s) => s.description),
        "No strengths were recorded during the session.",
      ),
    gap_analysis:
      note +
      bullets(
        facts.gaps.map(
          (g) => `${g.severity ? `${g.severity.toUpperCase()}: ` : ""}${g.description}`,
        ),
        "No gaps were recorded during the session.",
      ),
    action_plan:
      note +
      bullets(
        facts.action_items.map(
          (a) =>
            `${a.description}${a.owner_name ? ` (owner: ${a.owner_name})` : ""}${a.due_date ? ` (due ${a.due_date})` : ""}`,
        ),
        "No action items were recorded during the session.",
      ),
    closing:
      note +
      `The next tabletop exercise is due within 12 months of ${fmt(cover.ended_at, cover.timezone)}. Review the action items at the next plan review.`,
  };
}

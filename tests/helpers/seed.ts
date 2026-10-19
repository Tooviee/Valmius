import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import answers from "../fixtures/questionnaire-answers.json";
import planSections from "../fixtures/llm/plan-sections.json";
import { buildNotificationMatrixSection } from "../../src/lib/plan/notification-matrix";
import { PLAN_SECTION_IDS, planSectionMeta } from "../../src/lib/schemas/plan";

/**
 * Seeds an organization, an approved plan and exercises straight into the database with the
 * admin client, for tests and scripts that need a populated account without clicking through
 * the questionnaire, the generator and a live drill first. The e2e smoke tests still create
 * these through the UI; this is for the accessibility sweep, the phone test and screenshots.
 */

export const participantToken = () => randomBytes(32).toString("base64url");

function must<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error || result.data === null) {
    throw new Error(`${what}: ${result.error?.message ?? "no row returned"}`);
  }
  return result.data;
}

export async function seedOrganization(
  admin: SupabaseClient,
  userId: string,
  name = "Northwind Clinic",
): Promise<{ orgId: string; questionnaireId: string }> {
  const org = must(
    await admin
      .from("organizations")
      .insert({
        name,
        industry: "healthcare",
        headcount_band: "11-50",
        frameworks: ["hipaa", "soc2"],
        timezone: "America/New_York",
        created_by: userId,
      })
      .select("id")
      .single<{ id: string }>(),
    "organization",
  );
  must(
    await admin
      .from("org_members")
      .insert({ org_id: org.id, user_id: userId, role: "owner" })
      .select("org_id")
      .single(),
    "membership",
  );
  const questionnaire = must(
    await admin
      .from("questionnaires")
      .insert({
        org_id: org.id,
        answers,
        completed_at: new Date().toISOString(),
        created_by: userId,
      })
      .select("id")
      .single<{ id: string }>(),
    "questionnaire",
  );
  return { orgId: org.id, questionnaireId: questionnaire.id };
}

/** Version 1 of the plan, approved: fixture sections plus a real notification matrix. */
export async function seedApprovedPlan(
  admin: SupabaseClient,
  input: { orgId: string; questionnaireId: string; userId: string; companyName?: string },
): Promise<string> {
  const companyName = input.companyName ?? "Northwind Clinic";
  const sections = PLAN_SECTION_IDS.map((id) =>
    id === "notification_matrix"
      ? buildNotificationMatrixSection({
          companyName,
          frameworks: ["hipaa", "soc2"],
          dataTypes: answers.data_types,
          regulatoryObligations: answers.regulatory_obligations,
          customerObligations: answers.customer_notification_obligations,
          insurerName: answers.outside_parties.insurer_name,
          outsideCounsel: answers.outside_parties.outside_counsel,
          owners: {
            legal: "COO",
            executive: "CEO",
            communications: "Head of Patient Services",
            technical: "IT Manager",
          },
        })
      : {
          id,
          title: planSectionMeta(id).title,
          ...(planSections as Record<string, { markdown: string; framework_refs: string[] }>)[id],
          origin: "model",
        },
  );
  const plan = must(
    await admin
      .from("ir_plans")
      .insert({
        org_id: input.orgId,
        questionnaire_id: input.questionnaireId,
        version: 1,
        sections,
        status: "approved",
        approved_by_name: "Jordan Park, CEO",
        approved_at: new Date().toISOString(),
        created_by: input.userId,
      })
      .select("id")
      .single<{ id: string }>(),
    "plan",
  );
  return plan.id;
}

export type SeededExercise = { id: string; tokens: string[] };

/**
 * An exercise from the ransomware pack. "scheduled" has two participants and nothing else;
 * "live" started 23 minutes ago with two injects shown, three attendees, two decisions and
 * two findings; "ended" is the same drill finished a week ago with both participants signed off.
 */
export async function seedExercise(
  admin: SupabaseClient,
  input: {
    orgId: string;
    userId: string;
    status: "scheduled" | "live" | "ended";
    title: string;
  },
): Promise<SeededExercise> {
  const pack = must(
    await admin
      .from("scenarios")
      .select("id")
      .eq("is_pack", true)
      .eq("type", "ransomware")
      .limit(1)
      .single<{ id: string }>(),
    "ransomware pack (run pnpm db:seed)",
  );
  const start =
    input.status === "ended"
      ? new Date(Date.now() - 7 * 24 * 60 * 60_000)
      : new Date(Date.now() - 23 * 60_000);
  const at = (minutes: number) => new Date(start.getTime() + minutes * 60_000).toISOString();
  const timing =
    input.status === "scheduled"
      ? { scheduled_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString() }
      : input.status === "live"
        ? { started_at: at(0), revealed_count: 2, reveal_times: [at(1), at(16)] }
        : {
            // Ended drills start out live: decisions can only be logged while live.
            started_at: at(0),
            revealed_count: 4,
            reveal_times: [at(1), at(16), at(31), at(43)],
          };
  const exercise = must(
    await admin
      .from("exercises")
      .insert({
        org_id: input.orgId,
        scenario_id: pack.id,
        title: input.title,
        status: input.status === "ended" ? "live" : input.status,
        parking_lot:
          input.status === "scheduled" ? "" : "Check whether the MSP has after-hours cover.",
        facilitator_id: input.userId,
        ...timing,
      })
      .select("id")
      .single<{ id: string }>(),
    "exercise",
  );
  const people = [
    { name: "Pat Lee", role: "CEO" },
    { name: "Sam Ng", role: "IT Manager" },
    ...(input.status === "live" ? [{ name: "Morgan Chen", role: "Head of Patient Services" }] : []),
  ];
  const tokens = people.map(() => participantToken());
  must(
    await admin
      .from("exercise_participants")
      .insert(
        people.map((person, index) => ({
          exercise_id: exercise.id,
          ...person,
          token: tokens[index],
          ...(input.status === "scheduled" ? {} : { attended_at: at(-3 + index) }),
        })),
      )
      .select("id"),
    "participants",
  );
  if (input.status !== "scheduled") {
    const decisions = [
      ["Pat Lee", "Declare SEV1; Sam is Incident Commander, Morgan is Scribe", "Phone tree used"],
      ["Team", "Isolate the file server; do not power it off", "Preserve the ransom note"],
    ];
    for (const [index, [actor, decision, notes]] of decisions.entries()) {
      must(
        await admin
          .from("decision_log")
          .insert({
            exercise_id: exercise.id,
            inject_index: index,
            actor_name: actor,
            decision,
            notes,
            created_by: input.userId,
          })
          .select("id")
          .single(),
        "decision",
      );
    }
    must(
      await admin
        .from("findings")
        .insert([
          {
            exercise_id: exercise.id,
            kind: "strength",
            description: "SEV1 declared within two minutes.",
          },
          {
            exercise_id: exercise.id,
            kind: "gap",
            description: "Nobody could find the insurer's claims line.",
            severity: "high",
          },
        ])
        .select("id"),
      "findings",
    );
  }
  if (input.status === "ended") {
    must(
      await admin
        .from("exercises")
        .update({ status: "ended", ended_at: at(50) })
        .eq("id", exercise.id)
        .select("id")
        .single(),
      "end exercise",
    );
    for (const [index, person] of people.entries()) {
      must(
        await admin
          .from("exercise_participants")
          .update({ signed_off_at: at(52 + index), signature_name: person.name })
          .eq("exercise_id", exercise.id)
          .eq("token", tokens[index])
          .select("id")
          .single(),
        "sign-off",
      );
    }
  }
  return { id: exercise.id, tokens };
}

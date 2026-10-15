import "server-only";
import { isParticipantToken, isParticipantTokenExpired } from "@/lib/exercise/token";
import type { ExerciseStatus } from "@/lib/schemas/exercise";
import { scenarioSchema, type ScenarioInject } from "@/lib/schemas/scenario";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * What a participant may see: their own row, the exercise state, and only the injects the
 * facilitator has revealed, without the facilitator-only expected actions. Looked up with
 * the service role (SPEC.md section 6), never through RLS from the browser.
 */
export type ParticipantView = {
  participant: {
    id: string;
    name: string;
    role: string;
    attended_at: string | null;
    signed_off_at: string | null;
    signature_name: string | null;
  };
  exercise: {
    id: string;
    org_id: string;
    title: string;
    status: ExerciseStatus;
    started_at: string | null;
    ended_at: string | null;
    revealed_count: number;
    total_injects: number;
  };
  scenario: { title: string; summary: string; day_and_time: string };
  roster: { name: string; role: string }[];
  /** Revealed injects only, stripped of expected_actions. */
  injects: Pick<ScenarioInject, "index" | "offset_minutes" | "title" | "narrative" | "questions">[];
  wrapUpQuestions: string[];
};

export async function loadParticipantView(token: string): Promise<ParticipantView | null> {
  if (!isParticipantToken(token)) return null;
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("exercise_participants")
    .select(
      "id, name, role, attended_at, signed_off_at, signature_name, exercises(id, org_id, title, status, started_at, ended_at, revealed_count, scenarios(content), exercise_participants(name, role))",
    )
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error(`Could not load the participant: ${error.message}`);
  if (!data) return null;

  const exercise = data.exercises;
  if (isParticipantTokenExpired(exercise.ended_at)) return null;
  const scenario = scenarioSchema.safeParse(exercise.scenarios.content);
  if (!scenario.success) return null;

  const revealed = scenario.data.injects.slice(0, exercise.revealed_count);
  const allRevealed = exercise.revealed_count >= scenario.data.injects.length;

  return {
    participant: {
      id: data.id,
      name: data.name,
      role: data.role,
      attended_at: data.attended_at,
      signed_off_at: data.signed_off_at,
      signature_name: data.signature_name,
    },
    exercise: {
      id: exercise.id,
      org_id: exercise.org_id,
      title: exercise.title,
      status: exercise.status as ExerciseStatus,
      started_at: exercise.started_at,
      ended_at: exercise.ended_at,
      revealed_count: exercise.revealed_count,
      total_injects: scenario.data.injects.length,
    },
    scenario: {
      title: scenario.data.title,
      summary: scenario.data.summary,
      day_and_time: scenario.data.setting.day_and_time,
    },
    roster: exercise.exercise_participants.map((p) => ({ name: p.name, role: p.role })),
    injects: revealed.map(({ index, offset_minutes, title, narrative, questions }) => ({
      index,
      offset_minutes,
      title,
      narrative,
      questions,
    })),
    wrapUpQuestions:
      allRevealed || exercise.status !== "live" ? scenario.data.wrap_up_questions : [],
  };
}

"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOrgContext, type OrgContext } from "@/lib/auth/session";
import { loadExercise, type ExerciseRecord } from "@/lib/exercise/load";
import { getIpHash } from "@/lib/rate-limit/ip";
import {
  decisionEntrySchema,
  findingInputSchema,
  PARKING_LOT_MAX_LENGTH,
} from "@/lib/schemas/exercise";
import { logEvent } from "@/lib/supabase/events";
import { createClient } from "@/lib/supabase/server";
import type { ConsoleFormState, ParkingLotState } from "./types";

const asString = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");
const asOptional = (value: FormDataEntryValue | null) => {
  const text = asString(value).trim();
  return text ? text : undefined;
};

async function requireLiveExercise(
  exerciseId: string,
): Promise<{
  context: OrgContext;
  exercise: ExerciseRecord;
  supabase: Awaited<ReturnType<typeof createClient>>;
}> {
  const context = await getOrgContext();
  if (!context) redirect("/app/onboarding");
  const supabase = await createClient();
  const exercise = await loadExercise(supabase, exerciseId);
  if (!exercise) redirect("/app/exercises");
  return { context, exercise, supabase };
}

const consolePath = (exerciseId: string) => `/app/exercises/${exerciseId}/run`;

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".");
    if (!(key in errors)) errors[key] = issue.message;
  }
  return errors;
}

/** Shows the next inject to the room (and to participants, who poll). */
export async function revealInjectAction(formData: FormData): Promise<void> {
  const { context, exercise, supabase } = await requireLiveExercise(
    asString(formData.get("exerciseId")),
  );
  const total = exercise.scenario.content.injects.length;
  if (exercise.status !== "live" || exercise.revealed_count >= total) return;

  const { error } = await supabase
    .from("exercises")
    .update({
      revealed_count: exercise.revealed_count + 1,
      reveal_times: [...exercise.reveal_times, new Date().toISOString()],
    })
    .eq("id", exercise.id)
    .eq("revealed_count", exercise.revealed_count);
  if (error) throw new Error(`Could not reveal the inject: ${error.message}`);

  await logEvent(
    "inject_revealed",
    { index: exercise.revealed_count, total },
    getIpHash(await headers()),
    context.org.id,
  );
  revalidatePath(consolePath(exercise.id));
}

/** Adds a decision-log entry. The database stamps the time. */
export async function logDecisionAction(
  _previous: ConsoleFormState,
  formData: FormData,
): Promise<ConsoleFormState> {
  const exerciseId = asString(formData.get("exerciseId"));
  const rawIndex = asString(formData.get("injectIndex"));
  const parsed = decisionEntrySchema.safeParse({
    injectIndex: rawIndex === "" ? null : Number(rawIndex),
    actorName: asString(formData.get("actorName")),
    decision: asString(formData.get("decision")),
    notes: asString(formData.get("notes")),
  });
  if (!parsed.success)
    return { status: "invalid", fieldErrors: fieldErrorsOf(parsed.error.issues) };

  const { context, exercise, supabase } = await requireLiveExercise(exerciseId);
  if (exercise.status !== "live") return { status: "error", message: "The exercise is not live." };

  const { error } = await supabase.from("decision_log").insert({
    exercise_id: exercise.id,
    inject_index: parsed.data.injectIndex,
    actor_name: parsed.data.actorName,
    decision: parsed.data.decision,
    notes: parsed.data.notes,
    created_by: context.user.id,
  });
  if (error) {
    console.error("[console] decision insert failed:", error.message);
    return { status: "error", message: "The decision could not be saved." };
  }
  await logEvent(
    "decision_logged",
    { inject_index: parsed.data.injectIndex, has_notes: parsed.data.notes.length > 0 },
    getIpHash(await headers()),
    context.org.id,
  );
  revalidatePath(consolePath(exercise.id));
  return { status: "ok", savedAt: new Date().toISOString() };
}

/** Corrects an entry while the exercise is live; the database keeps the original time. */
export async function updateDecisionAction(
  _previous: ConsoleFormState,
  formData: FormData,
): Promise<ConsoleFormState> {
  const exerciseId = asString(formData.get("exerciseId"));
  const decisionId = asString(formData.get("decisionId"));
  const parsed = decisionEntrySchema
    .pick({ decision: true, notes: true })
    .safeParse({
      decision: asString(formData.get("decision")),
      notes: asString(formData.get("notes")),
    });
  if (!parsed.success)
    return { status: "invalid", fieldErrors: fieldErrorsOf(parsed.error.issues) };

  const { exercise, supabase } = await requireLiveExercise(exerciseId);
  const { error } = await supabase
    .from("decision_log")
    .update({ decision: parsed.data.decision, notes: parsed.data.notes })
    .eq("id", decisionId)
    .eq("exercise_id", exercise.id);
  if (error)
    return { status: "error", message: "The entry could not be changed; the log may be locked." };
  revalidatePath(consolePath(exercise.id));
  return { status: "ok", savedAt: new Date().toISOString() };
}

export async function deleteDecisionAction(formData: FormData): Promise<void> {
  const { exercise, supabase } = await requireLiveExercise(asString(formData.get("exerciseId")));
  await supabase
    .from("decision_log")
    .delete()
    .eq("id", asString(formData.get("decisionId")))
    .eq("exercise_id", exercise.id);
  revalidatePath(consolePath(exercise.id));
}

/** Quick-add Strength, Gap or Action item. Allowed during the exercise and the debrief. */
export async function addFindingAction(
  _previous: ConsoleFormState,
  formData: FormData,
): Promise<ConsoleFormState> {
  const exerciseId = asString(formData.get("exerciseId"));
  const parsed = findingInputSchema.safeParse({
    kind: asString(formData.get("kind")),
    description: asString(formData.get("description")),
    severity: asOptional(formData.get("severity")),
    ownerName: asString(formData.get("ownerName")),
    dueDate: asOptional(formData.get("dueDate")),
  });
  if (!parsed.success)
    return { status: "invalid", fieldErrors: fieldErrorsOf(parsed.error.issues) };

  const { context, exercise, supabase } = await requireLiveExercise(exerciseId);
  const { error } = await supabase.from("findings").insert({
    exercise_id: exercise.id,
    kind: parsed.data.kind,
    description: parsed.data.description,
    severity: parsed.data.severity ?? null,
    owner_name: parsed.data.ownerName || null,
    due_date: parsed.data.dueDate ?? null,
    created_by: context.user.id,
  });
  if (error) {
    console.error("[console] finding insert failed:", error.message);
    return { status: "error", message: "The finding could not be saved." };
  }
  await logEvent(
    "finding_added",
    { kind: parsed.data.kind, severity: parsed.data.severity ?? null, status: exercise.status },
    getIpHash(await headers()),
    context.org.id,
  );
  revalidatePath(consolePath(exercise.id));
  return { status: "ok", savedAt: new Date().toISOString() };
}

export async function deleteFindingAction(formData: FormData): Promise<void> {
  const { exercise, supabase } = await requireLiveExercise(asString(formData.get("exerciseId")));
  await supabase
    .from("findings")
    .delete()
    .eq("id", asString(formData.get("findingId")))
    .eq("exercise_id", exercise.id);
  revalidatePath(consolePath(exercise.id));
}

/** Autosaves the parking lot (notes that are not decisions or findings). */
export async function saveParkingLotAction(
  _previous: ParkingLotState,
  formData: FormData,
): Promise<ParkingLotState> {
  const exerciseId = asString(formData.get("exerciseId"));
  const parkingLot = asString(formData.get("parkingLot")).slice(0, PARKING_LOT_MAX_LENGTH);
  const { exercise, supabase } = await requireLiveExercise(exerciseId);
  const { error } = await supabase
    .from("exercises")
    .update({ parking_lot: parkingLot })
    .eq("id", exercise.id);
  if (error) return { status: "error" };
  return { status: "saved", savedAt: new Date().toISOString() };
}

/** Ends the exercise: status ended, the log locks, participants get the sign-off form. */
export async function endExerciseAction(formData: FormData): Promise<void> {
  const { context, exercise, supabase } = await requireLiveExercise(
    asString(formData.get("exerciseId")),
  );
  if (exercise.status !== "live") {
    revalidatePath(consolePath(exercise.id));
    return;
  }
  const { error } = await supabase
    .from("exercises")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", exercise.id)
    .eq("status", "live");
  if (error) throw new Error(`Could not end the exercise: ${error.message}`);

  await logEvent(
    "exercise_ended",
    {
      injects_revealed: exercise.revealed_count,
      decisions: exercise.decisions.length,
      findings: exercise.findings.length,
      attended: exercise.participants.filter((p) => p.attended_at).length,
      participants: exercise.participants.length,
      duration_minutes: exercise.started_at
        ? Math.round((Date.now() - new Date(exercise.started_at).getTime()) / 60_000)
        : null,
    },
    getIpHash(await headers()),
    context.org.id,
  );
  revalidatePath(consolePath(exercise.id));
  revalidatePath(`/app/exercises/${exercise.id}`);
}

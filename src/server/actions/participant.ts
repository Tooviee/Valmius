"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { loadParticipantView } from "@/lib/exercise/participant";
import { isParticipantToken, participantPath } from "@/lib/exercise/token";
import { checkRateLimit } from "@/lib/rate-limit";
import { getIpHash } from "@/lib/rate-limit/ip";
import { signOffSchema } from "@/lib/schemas/exercise";
import { getAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/supabase/events";
import type { ParticipantActionState } from "./types";

const asString = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");

/**
 * Participant actions carry the link token instead of a session. Both are checked with
 * the service role after validating the token, and limited per IP.
 */
export async function confirmAttendanceAction(
  _previous: ParticipantActionState,
  formData: FormData,
): Promise<ParticipantActionState> {
  const token = asString(formData.get("token"));
  if (!isParticipantToken(token)) return { status: "invalid_link" };
  const ipHash = getIpHash(await headers());
  if ((await checkRateLimit("participant", ipHash)) === "blocked")
    return { status: "rate_limited" };

  const view = await loadParticipantView(token);
  if (!view) return { status: "invalid_link" };
  if (view.participant.attended_at) return { status: "ok" };

  const { error } = await getAdminClient()
    .from("exercise_participants")
    .update({ attended_at: new Date().toISOString() })
    .eq("id", view.participant.id);
  if (error) return { status: "error" };

  await logEvent(
    "participant_attended",
    { status: view.exercise.status },
    ipHash,
    view.exercise.org_id,
  );
  revalidatePath(participantPath(token));
  return { status: "ok" };
}

export async function signOffAction(
  _previous: ParticipantActionState,
  formData: FormData,
): Promise<ParticipantActionState> {
  const token = asString(formData.get("token"));
  if (!isParticipantToken(token)) return { status: "invalid_link" };
  const parsed = signOffSchema.safeParse({
    signatureName: asString(formData.get("signatureName")),
  });
  if (!parsed.success) return { status: "invalid", message: "Type your full name to sign off." };

  const ipHash = getIpHash(await headers());
  if ((await checkRateLimit("participant", ipHash)) === "blocked")
    return { status: "rate_limited" };

  const view = await loadParticipantView(token);
  if (!view) return { status: "invalid_link" };
  if (view.exercise.status !== "ended" && view.exercise.status !== "reported") {
    return { status: "invalid", message: "Sign-off opens once the facilitator ends the exercise." };
  }
  if (view.participant.signed_off_at) return { status: "ok" };

  const { error } = await getAdminClient()
    .from("exercise_participants")
    .update({
      signed_off_at: new Date().toISOString(),
      signature_name: parsed.data.signatureName,
      // Signing off counts as having been there, for someone who never pressed the button.
      attended_at: view.participant.attended_at ?? new Date().toISOString(),
    })
    .eq("id", view.participant.id);
  if (error) return { status: "error" };

  await logEvent("participant_signed_off", {}, ipHash, view.exercise.org_id);
  revalidatePath(participantPath(token));
  return { status: "ok" };
}

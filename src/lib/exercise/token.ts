import { randomBytes } from "node:crypto";

/** Participant links carry 32 random bytes as base64url (SPEC.md section 11): 43 characters. */
export const PARTICIPANT_TOKEN_LENGTH = 43;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Days a link keeps working after the exercise ends (SPEC.md section 11). */
export const PARTICIPANT_TOKEN_GRACE_DAYS = 30;

export function generateParticipantToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isParticipantToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export function participantPath(token: string): string {
  return `/x/${token}`;
}

/** True once a link may no longer be used: 30 days after the exercise ended. */
export function isParticipantTokenExpired(endedAt: string | null, now: Date = new Date()): boolean {
  if (!endedAt) return false;
  const expiry = new Date(endedAt).getTime() + PARTICIPANT_TOKEN_GRACE_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() > expiry;
}

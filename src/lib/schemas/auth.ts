import { z } from "zod";

/** The sign-in form: one email address. */
export const loginEmailSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
});

export type LoginInput = z.infer<typeof loginEmailSchema>;

/** The `type` values a Supabase email link can carry to /auth/confirm. */
export const EMAIL_OTP_TYPES = [
  "email",
  "magiclink",
  "signup",
  "invite",
  "recovery",
  "email_change",
] as const;
export type EmailOtpType = (typeof EMAIL_OTP_TYPES)[number];

export function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (EMAIL_OTP_TYPES as readonly string[]).includes(value);
}

/**
 * Where to send someone after sign-in. Only a path on this site is accepted, so a
 * crafted link cannot bounce a visitor to another host after they authenticate.
 */
export function safeNextPath(value: string | null | undefined, fallback = "/app"): string {
  if (!value || value.length > 512) return fallback;
  if (!/^\/(?![/\\])[^\s]*$/.test(value)) return fallback;
  return value;
}

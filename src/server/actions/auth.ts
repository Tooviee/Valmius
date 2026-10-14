"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getIpHash } from "@/lib/rate-limit/ip";
import { loginEmailSchema } from "@/lib/schemas/auth";
import { logEvent } from "@/lib/supabase/events";
import { createClient } from "@/lib/supabase/server";
import type { LoginState } from "./types";

/**
 * Emails a magic link. Supabase creates the account on first use, so there is no
 * separate sign-up. The email itself is never logged (SPEC.md section 5).
 */
export async function requestLoginLinkAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginEmailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "invalid" };

  const ipHash = getIpHash(await headers());
  if ((await checkRateLimit("login", ipHash)) === "blocked") return { status: "rate_limited" };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      // The email template links here with the token hash (SUPABASE-SETUP.md section 5).
      emailRedirectTo: `${siteUrl}/auth/confirm`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    console.error(
      `[auth] magic link request failed (${error.status ?? "no status"}):`,
      error.message,
    );
    await logEvent("login_link_failed", { status: error.status ?? null }, ipHash);
    // Supabase's own email limit answers 429; everything else is a configuration problem.
    return { status: error.status === 429 ? "rate_limited" : "error" };
  }

  await logEvent("login_link_requested", {}, ipHash);
  return { status: "sent" };
}

/** Ends the session on this device and returns to the sign-in page. */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}

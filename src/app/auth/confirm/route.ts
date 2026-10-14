import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { isEmailOtpType, safeNextPath } from "@/lib/schemas/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Where the sign-in email lands. Two link shapes arrive here:
 *
 * - `?token_hash=...&type=...` from a customized template. Verified directly, so it
 *   works from any browser or device. Supabase only lets templates be edited once
 *   custom SMTP is configured (SUPABASE-SETUP.md section 5b).
 * - `?code=...` from Supabase's default template, which bounces through Supabase's own
 *   verify endpoint first. The code is exchanged with the PKCE verifier cookie that the
 *   sign-in form set, so it only works in the browser that requested the link.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const supabase = await createClient();

  const code = searchParams.get("code");
  if (code) {
    if (code.length > 512) redirect("/login?error=link");
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.warn(
        `[auth] code exchange failed (${error.status ?? "no status"}): ${error.message}`,
      );
      // The usual cause is opening the link somewhere other than where it was requested.
      redirect("/login?error=device");
    }
    redirect(next);
  }

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") ?? "email";
  if (!tokenHash || tokenHash.length > 512 || !isEmailOtpType(type)) {
    redirect("/login?error=link");
  }

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    console.warn(`[auth] magic link rejected (${error.status ?? "no status"}): ${error.message}`);
    redirect("/login?error=link");
  }

  redirect(next);
}

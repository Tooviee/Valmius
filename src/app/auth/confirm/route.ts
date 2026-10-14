import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { isEmailOtpType, safeNextPath } from "@/lib/schemas/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Where the magic-link email lands. The link carries a token hash rather than a
 * session, so it works from any browser or device; this handler exchanges it for a
 * session cookie and sends the user into the app.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") ?? "email";
  const next = safeNextPath(searchParams.get("next"));

  if (!tokenHash || tokenHash.length > 512 || !isEmailOtpType(type)) {
    redirect("/login?error=link");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    console.warn(`[auth] magic link rejected (${error.status ?? "no status"}): ${error.message}`);
    redirect("/login?error=link");
  }

  redirect(next);
}

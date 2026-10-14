import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null };

export type Organization = Tables<"organizations">;
export type OrgRole = "owner" | "member";

export type OrgContext = {
  user: SessionUser;
  org: Organization;
  role: OrgRole;
};

/**
 * The signed-in user, from the session cookie. The token is verified before it is
 * trusted; nothing here is read from the cookie unverified. Cached per request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) return null;
  const { sub, email } = data.claims;
  return { id: sub, email: typeof email === "string" ? email : null };
});

/** The signed-in user, or a redirect to the sign-in page. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** The user's organization and role, or null when they have not created one yet. */
export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  // RLS limits this to the user's own memberships; the MVP has one per account.
  const { data, error } = await supabase
    .from("org_members")
    .select("role, organizations(*)")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load the organization: ${error.message}`);
  if (!data?.organizations) return null;

  return { user, org: data.organizations, role: data.role as OrgRole };
});

/** The user's organization, or a redirect to onboarding (or sign-in) when there is none. */
export async function requireOrg(): Promise<OrgContext> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const context = await getOrgContext();
  if (!context) redirect("/app/onboarding");
  return context;
}

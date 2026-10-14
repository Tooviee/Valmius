import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { E2E_EMAIL_DOMAIN } from "./test-data";

export type TestUser = { id: string; email: string; password: string };

/**
 * Creates a confirmed test user through the Auth admin API. The address is on the
 * reserved test domain, so it can never reach a real inbox, and the password exists
 * only so database tests can sign in without an email round trip.
 */
export async function createTestUser(admin: SupabaseClient, label: string): Promise<TestUser> {
  const email = `${label}-${randomUUID().slice(0, 8)}@${E2E_EMAIL_DOMAIN}`;
  const password = `test-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Could not create test user: ${error?.message}`);
  return { id: data.user.id, email, password };
}

/** Deletes a test user. Organizations they created cascade away with them. */
export async function deleteTestUser(admin: SupabaseClient, id: string): Promise<void> {
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(`Could not delete test user: ${error.message}`);
}

/** Removes every user on the reserved test domain, for cleanup after a crashed run. */
export async function deleteTestUsers(admin: SupabaseClient): Promise<void> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`Could not list users: ${error.message}`);
  const stale = data.users.filter((user) => user.email?.endsWith(`@${E2E_EMAIL_DOMAIN}`));
  await Promise.all(stale.map((user) => deleteTestUser(admin, user.id)));
}

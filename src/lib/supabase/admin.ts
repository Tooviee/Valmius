import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let adminClient: SupabaseClient<Database> | undefined;

/**
 * Server-only Supabase client that uses the secret key and so bypasses RLS.
 * `leads`, `events` and `rate_limits` are reachable only through this client.
 */
export function getAdminClient(): SupabaseClient<Database> {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
  }

  adminClient = createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

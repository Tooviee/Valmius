import { createClient } from "@supabase/supabase-js";
import { deleteTestUsers } from "../helpers/auth-users";
import { loadSupabaseTestEnv } from "../helpers/env";
import { deleteE2ERows, testIpHash } from "../helpers/test-data";

// Removes the rows this run created in the hosted project.
export default async function globalTeardown() {
  const env = loadSupabaseTestEnv();
  const supabase = createClient(env.supabaseUrl, env.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await deleteE2ERows(supabase, testIpHash(env.ipHashSalt));
  // Test accounts (and, by cascade, their organizations and plans).
  await deleteTestUsers(supabase);
}

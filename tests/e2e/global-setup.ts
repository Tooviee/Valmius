import { createClient } from "@supabase/supabase-js";
import { loadSupabaseTestEnv } from "../helpers/env";
import { deleteE2ERows, testIpHash } from "../helpers/test-data";

// Clears anything a previous run left behind (a crashed run, or a rate-limit window
// that would otherwise block the test IP), so every run starts from the same state.
export default async function globalSetup() {
  const env = loadSupabaseTestEnv();
  const supabase = createClient(env.supabaseUrl, env.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await deleteE2ERows(supabase, testIpHash(env.ipHashSalt));
}

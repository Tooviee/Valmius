import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Reserved documentation range (TEST-NET-3): never a real visitor. */
export const E2E_TEST_IP = "203.0.113.7";

/** Reserved TLD: addresses here can never belong to a real person. */
export const E2E_EMAIL_DOMAIN = "e2e.drillday.test";

/** Same keyed hash as src/lib/rate-limit/ip.ts, which test runners cannot import (server-only). */
export function testIpHash(salt: string, ip: string = E2E_TEST_IP): string {
  return createHmac("sha256", salt).update(ip).digest("hex");
}

/** Removes exactly the rows the end-to-end tests can create. Safe to run at any time. */
export async function deleteE2ERows(supabase: SupabaseClient, ipHash: string): Promise<void> {
  const results = await Promise.all([
    supabase.from("rate_limits").delete().like("key", `%:${ipHash}`),
    supabase.from("events").delete().eq("ip_hash", ipHash),
    supabase.from("leads").delete().like("email", `%@${E2E_EMAIL_DOMAIN}`),
  ]);
  for (const { error } of results) {
    if (error) throw new Error(`E2E cleanup failed: ${error.message}`);
  }
}

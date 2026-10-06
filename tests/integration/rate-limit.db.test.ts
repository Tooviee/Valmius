import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { getAdminClient } from "@/lib/supabase/admin";

// Exercises the real `bump_rate_limit` SQL function through the app's own wrapper.
const ipHash = `test-${randomUUID()}`;

afterAll(async () => {
  await getAdminClient().from("rate_limits").delete().eq("key", rateLimitKey("generate", ipHash));
});

describe("bump_rate_limit against the database", () => {
  it("allows 5 generations and blocks the 6th within the hour", async () => {
    const results = [];
    for (let request = 1; request <= 6; request += 1) {
      results.push(await checkRateLimit("generate", ipHash));
    }

    expect(results).toEqual(["allowed", "allowed", "allowed", "allowed", "allowed", "blocked"]);

    const { data } = await getAdminClient()
      .from("rate_limits")
      .select("count")
      .eq("key", rateLimitKey("generate", ipHash))
      .single();
    expect(data?.count).toBe(6);
  });
});

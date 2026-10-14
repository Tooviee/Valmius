import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { createTestUser, deleteTestUser } from "../helpers/auth-users";
import { loadSupabaseTestEnv } from "../helpers/env";

// Proves the Phase 1 migration's grants and RLS against the hosted project:
// the secret key reaches everything, the publishable key reaches only public packs.
const env = loadSupabaseTestEnv();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient<Database>(env.supabaseUrl, env.secretKey, options);
const anon = createClient<Database>(env.supabaseUrl, env.publishableKey, options);

const PERMISSION_DENIED = "42501";
const privateScenarioId = randomUUID();
let ownerId: string;
let orgId: string;

// Since Phase 2, scenarios.org_id is a foreign key, so an org-owned scenario needs a real
// organization, which in turn needs a real user. Deleting the user cascades both away.
beforeAll(async () => {
  ownerId = (await createTestUser(admin, "db-access")).id;
  const { data, error } = await admin
    .from("organizations")
    .insert({
      name: "DB access test org",
      industry: "other",
      headcount_band: "1-10",
      timezone: "UTC",
      created_by: ownerId,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not create test organization: ${error.message}`);
  orgId = data.id;
});

afterAll(async () => {
  await deleteTestUser(admin, ownerId);
});

describe("phase 1 grants and RLS", () => {
  it.each(["scenarios", "leads", "events", "rate_limits"] as const)(
    "secret key can read %s",
    async (table) => {
      const { error } = await admin.from(table).select("*", { count: "exact", head: true });
      expect(error).toBeNull();
    },
  );

  it.each(["leads", "events", "rate_limits"] as const)(
    "publishable key is denied on %s",
    async (table) => {
      const { data, error } = await anon.from(table).select("*").limit(1);
      expect(data).toBeNull();
      expect(error?.code).toBe(PERMISSION_DENIED);
    },
  );

  it("publishable key cannot insert a lead", async () => {
    const { error } = await anon.from("leads").insert({ email: "blocked@e2e.drillday.test" });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("publishable key cannot call bump_rate_limit", async () => {
    const { error } = await anon.rpc("bump_rate_limit", {
      p_key: "test:anon",
      p_limit: 5,
      p_window_seconds: 3600,
    });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("publishable key cannot write scenarios", async () => {
    const { error } = await anon.from("scenarios").insert({
      type: "custom",
      title: "Should be rejected",
      content: {},
      is_pack: true,
    });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("publishable key sees public packs but not an org-owned scenario", async () => {
    const { error: insertError } = await admin.from("scenarios").insert({
      id: privateScenarioId,
      org_id: orgId,
      type: "custom",
      title: "Private test scenario",
      content: {},
      is_pack: false,
    });
    expect(insertError).toBeNull();

    const { data, error } = await anon.from("scenarios").select("id, is_pack, org_id");
    expect(error).toBeNull();
    expect(data?.some((row) => row.id === privateScenarioId)).toBe(false);
    expect(data?.every((row) => row.is_pack && row.org_id === null)).toBe(true);
  });
});

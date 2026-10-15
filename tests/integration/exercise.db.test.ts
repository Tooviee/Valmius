import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { createTestUser, deleteTestUser, type TestUser } from "../helpers/auth-users";
import { loadSupabaseTestEnv } from "../helpers/env";

// Proves the Phase 3 migrations against the hosted project: member-only access to
// exercises and their children, the decision-log lock after the end (SPEC.md section 7,
// Phase 3 verify), server timestamps, and forward-only status.
const env = loadSupabaseTestEnv();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient<Database>(env.supabaseUrl, env.secretKey, options);
const anon = createClient<Database>(env.supabaseUrl, env.publishableKey, options);

const PERMISSION_DENIED = "42501";
const CHECK_VIOLATION = "23514";
const TOKEN = "a".repeat(43);

type UserClient = SupabaseClient<Database>;

async function signedInClient(user: TestUser): Promise<UserClient> {
  const client = createClient<Database>(env.supabaseUrl, env.publishableKey, options);
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw new Error(`Could not sign in ${user.email}: ${error.message}`);
  return client;
}

const ORG = {
  p_name: "Exercise Co",
  p_industry: "saas_software",
  p_headcount_band: "11-50",
  p_frameworks: ["soc2"],
  p_timezone: "UTC",
};

let alice: TestUser;
let bob: TestUser;
let aliceClient: UserClient;
let bobClient: UserClient;
let aliceOrgId: string;
let packScenarioId: string;
let exerciseId: string;
let decisionId: string;

beforeAll(async () => {
  [alice, bob] = await Promise.all([
    createTestUser(admin, "ex-alice"),
    createTestUser(admin, "ex-bob"),
  ]);
  [aliceClient, bobClient] = await Promise.all([signedInClient(alice), signedInClient(bob)]);
  aliceOrgId = (await aliceClient.rpc("create_organization", ORG)).data as string;
  await bobClient.rpc("create_organization", { ...ORG, p_name: "Other Co" });
  const { data: pack } = await aliceClient
    .from("scenarios")
    .select("id")
    .eq("is_pack", true)
    .limit(1)
    .single();
  packScenarioId = pack!.id;
});

afterAll(async () => {
  await Promise.all([deleteTestUser(admin, alice.id), deleteTestUser(admin, bob.id)]);
});

describe("org-owned scenarios", () => {
  it("members add and read their own custom scenarios; nobody else sees them", async () => {
    const { data, error } = await aliceClient
      .from("scenarios")
      .insert({ org_id: aliceOrgId, type: "bec", title: "Custom BEC", content: {}, is_pack: false })
      .select("id")
      .single();
    expect(error).toBeNull();

    const mine = await aliceClient.from("scenarios").select("id").eq("id", data!.id);
    expect(mine.data).toHaveLength(1);
    const theirs = await bobClient.from("scenarios").select("id").eq("id", data!.id);
    expect(theirs.data).toEqual([]);
    const anonymous = await anon.from("scenarios").select("id").eq("id", data!.id);
    expect(anonymous.data).toEqual([]);

    const asPack = await aliceClient
      .from("scenarios")
      .insert({ org_id: aliceOrgId, type: "bec", title: "Fake pack", content: {}, is_pack: true });
    expect(asPack.error?.code).toBe(PERMISSION_DENIED);
  });
});

describe("exercise lifecycle and the decision-log lock", () => {
  it("a member schedules an exercise with participants; other orgs see nothing", async () => {
    const created = await aliceClient
      .from("exercises")
      .insert({
        org_id: aliceOrgId,
        scenario_id: packScenarioId,
        title: "Q4 drill",
        facilitator_id: alice.id,
      })
      .select("id, status")
      .single();
    expect(created.error).toBeNull();
    expect(created.data?.status).toBe("scheduled");
    exerciseId = created.data!.id;

    const participant = await aliceClient
      .from("exercise_participants")
      .insert({ exercise_id: exerciseId, name: "Pat Lee", role: "CEO", token: TOKEN })
      .select("id")
      .single();
    expect(participant.error).toBeNull();

    expect((await bobClient.from("exercises").select("id")).data).toEqual([]);
    expect((await bobClient.from("exercise_participants").select("id")).data).toEqual([]);
    const intruder = await bobClient
      .from("exercise_participants")
      .insert({ exercise_id: exerciseId, name: "Mallory", role: "x", token: "b".repeat(43) });
    expect(intruder.error?.code).toBe(PERMISSION_DENIED);
  });

  it("refuses log entries before the exercise is live", async () => {
    const { error } = await aliceClient
      .from("decision_log")
      .insert({ exercise_id: exerciseId, actor_name: "Team", decision: "Too early" });
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("stamps log entries with the server clock and allows corrections while live", async () => {
    const start = await aliceClient
      .from("exercises")
      .update({ status: "live", started_at: new Date().toISOString() })
      .eq("id", exerciseId)
      .select("status")
      .single();
    expect(start.error).toBeNull();

    const { data, error } = await aliceClient
      .from("decision_log")
      .insert({
        exercise_id: exerciseId,
        inject_index: 0,
        actor_name: "Team",
        decision: "Isolate the file server.",
        logged_at: "2000-01-01T00:00:00.000Z",
        created_by: alice.id,
      })
      .select("id, logged_at")
      .single();
    expect(error).toBeNull();
    expect(Date.now() - new Date(data!.logged_at).getTime()).toBeLessThan(60_000);
    decisionId = data!.id;

    const fixed = await aliceClient
      .from("decision_log")
      .update({ decision: "Isolate the file server now." })
      .eq("id", decisionId)
      .select("decision, logged_at")
      .single();
    expect(fixed.error).toBeNull();
    expect(fixed.data?.logged_at).toBe(data!.logged_at);

    const finding = await aliceClient
      .from("findings")
      .insert({
        exercise_id: exerciseId,
        kind: "gap",
        description: "No restore test.",
        severity: "high",
      });
    expect(finding.error).toBeNull();
  });

  it("locks the log once the exercise has ended, but still takes debrief findings", async () => {
    const end = await aliceClient
      .from("exercises")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", exerciseId)
      .select("status")
      .single();
    expect(end.error).toBeNull();

    const insert = await aliceClient
      .from("decision_log")
      .insert({ exercise_id: exerciseId, actor_name: "Team", decision: "Late entry" });
    expect(insert.error?.code).toBe(CHECK_VIOLATION);
    const update = await aliceClient
      .from("decision_log")
      .update({ notes: "edited" })
      .eq("id", decisionId);
    expect(update.error?.code).toBe(CHECK_VIOLATION);
    const remove = await aliceClient.from("decision_log").delete().eq("id", decisionId);
    expect(remove.error?.code).toBe(CHECK_VIOLATION);

    const debrief = await aliceClient
      .from("findings")
      .insert({
        exercise_id: exerciseId,
        kind: "action_item",
        description: "Schedule a restore test.",
        owner_name: "IT Manager",
      });
    expect(debrief.error).toBeNull();
  });

  it("never moves backwards and keeps its end time", async () => {
    const back = await aliceClient
      .from("exercises")
      .update({ status: "live" })
      .eq("id", exerciseId);
    expect(back.error?.code).toBe(CHECK_VIOLATION);
    const retime = await aliceClient
      .from("exercises")
      .update({ ended_at: "2000-01-01T00:00:00.000Z" })
      .eq("id", exerciseId);
    expect(retime.error?.code).toBe(CHECK_VIOLATION);
    const remove = await aliceClient.from("exercises").delete().eq("id", exerciseId).select("id");
    expect(remove.error).toBeNull();
    expect(remove.data).toEqual([]);
  });

  it("the server records attendance and sign-off through the service role", async () => {
    const attended = await admin
      .from("exercise_participants")
      .update({ attended_at: new Date().toISOString() })
      .eq("token", TOKEN)
      .select("id")
      .single();
    expect(attended.error).toBeNull();

    const half = await admin
      .from("exercise_participants")
      .update({ signature_name: "Pat Lee" })
      .eq("token", TOKEN);
    expect(half.error?.code).toBe(CHECK_VIOLATION);

    const signed = await admin
      .from("exercise_participants")
      .update({ signed_off_at: new Date().toISOString(), signature_name: "Pat Lee" })
      .eq("token", TOKEN)
      .select("signed_off_at")
      .single();
    expect(signed.error).toBeNull();
    expect(signed.data?.signed_off_at).not.toBeNull();
  });
});

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateParticipantToken } from "@/lib/exercise/token";
import type { Database } from "@/lib/supabase/database.types";
import { createTestUser, deleteTestUser, type TestUser } from "../helpers/auth-users";
import { loadSupabaseTestEnv } from "../helpers/env";

// Proves the Phase 4 migration against the hosted project: report drafts are editable,
// final reports are immutable and undeletable, amended versions are new rows, finalizing
// an exercise (status reported) freezes its findings, and other orgs see nothing.
const env = loadSupabaseTestEnv();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient<Database>(env.supabaseUrl, env.secretKey, options);

const PERMISSION_DENIED = "42501";
const CHECK_VIOLATION = "23514";
const SHA = "a".repeat(64);

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

let alice: TestUser;
let bob: TestUser;
let aliceClient: UserClient;
let bobClient: UserClient;
let orgId: string;
let exerciseId: string;
let reportId: string;

beforeAll(async () => {
  [alice, bob] = await Promise.all([
    createTestUser(admin, "rep-alice"),
    createTestUser(admin, "rep-bob"),
  ]);
  [aliceClient, bobClient] = await Promise.all([signedInClient(alice), signedInClient(bob)]);
  orgId = (
    await aliceClient.rpc("create_organization", {
      p_name: "Report Co",
      p_industry: "saas_software",
      p_headcount_band: "11-50",
      p_frameworks: ["soc2"],
      p_timezone: "UTC",
    })
  ).data as string;
  await bobClient.rpc("create_organization", {
    p_name: "Other Co",
    p_industry: "other",
    p_headcount_band: "1-10",
    p_frameworks: [],
    p_timezone: "UTC",
  });
  const { data: pack } = await aliceClient
    .from("scenarios")
    .select("id")
    .eq("is_pack", true)
    .limit(1)
    .single();
  const started = new Date(Date.now() - 3_600_000).toISOString();
  const { data: exercise } = await aliceClient
    .from("exercises")
    .insert({
      org_id: orgId,
      scenario_id: pack!.id,
      title: "Reported drill",
      facilitator_id: alice.id,
    })
    .select("id")
    .single();
  exerciseId = exercise!.id;
  await aliceClient
    .from("exercise_participants")
    .insert({
      exercise_id: exerciseId,
      name: "Pat",
      role: "CEO",
      token: generateParticipantToken(),
    });
  await aliceClient
    .from("exercises")
    .update({ status: "live", started_at: started })
    .eq("id", exerciseId);
  await aliceClient
    .from("findings")
    .insert({
      exercise_id: exerciseId,
      kind: "gap",
      description: "Untested backups",
      severity: "high",
    });
  await aliceClient
    .from("exercises")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", exerciseId);
});

afterAll(async () => {
  await Promise.all([deleteTestUser(admin, alice.id), deleteTestUser(admin, bob.id)]);
});

describe("report drafts and finals", () => {
  it("members create and edit a draft; other orgs see nothing", async () => {
    const { data, error } = await aliceClient
      .from("reports")
      .insert({
        exercise_id: exerciseId,
        org_id: orgId,
        version: 1,
        content: { narrative: { closing: "draft" } },
        created_by: alice.id,
      })
      .select("id, status")
      .single();
    expect(error).toBeNull();
    expect(data?.status).toBe("draft");
    reportId = data!.id;

    const edit = await aliceClient
      .from("reports")
      .update({ content: { narrative: { closing: "edited" } } })
      .eq("id", reportId);
    expect(edit.error).toBeNull();

    expect((await bobClient.from("reports").select("id")).data).toEqual([]);
    const intruder = await bobClient
      .from("reports")
      .insert({ exercise_id: exerciseId, org_id: orgId, version: 9, content: {} });
    expect(intruder.error?.code).toBe(PERMISSION_DENIED);
  });

  it("a final needs its file fields, and then never changes or disappears", async () => {
    const half = await aliceClient.from("reports").update({ status: "final" }).eq("id", reportId);
    expect(half.error?.code).toBe(CHECK_VIOLATION);

    const finalized = await aliceClient
      .from("reports")
      .update({
        status: "final",
        pdf_path: `${orgId}/${exerciseId}/v1.pdf`,
        sha256: SHA,
        finalized_at: new Date().toISOString(),
      })
      .eq("id", reportId)
      .select("status")
      .single();
    expect(finalized.error).toBeNull();
    expect(finalized.data?.status).toBe("final");

    const edit = await aliceClient
      .from("reports")
      .update({ content: { narrative: { closing: "tampered" } } })
      .eq("id", reportId);
    expect(edit.error?.code).toBe(CHECK_VIOLATION);
    const unfinal = await aliceClient
      .from("reports")
      .update({ status: "draft", pdf_path: null, sha256: null, finalized_at: null })
      .eq("id", reportId);
    expect(unfinal.error?.code).toBe(CHECK_VIOLATION);
    const remove = await aliceClient.from("reports").delete().eq("id", reportId).select("id");
    expect(remove.error).toBeNull();
    expect(remove.data).toEqual([]); // the delete policy only allows drafts
    const adminRemove = await admin.from("reports").delete().eq("id", reportId);
    expect(adminRemove.error?.code).toBe(CHECK_VIOLATION); // and even the server cannot delete a final
  });

  it("an amended version is a new row, and the same version number is refused", async () => {
    const dup = await aliceClient
      .from("reports")
      .insert({ exercise_id: exerciseId, org_id: orgId, version: 1, content: {} });
    expect(dup.error?.code).toBe("23505");
    const amended = await aliceClient
      .from("reports")
      .insert({
        exercise_id: exerciseId,
        org_id: orgId,
        version: 2,
        content: { narrative: { closing: "v2" } },
      })
      .select("version")
      .single();
    expect(amended.error).toBeNull();
    expect(amended.data?.version).toBe(2);
  });

  it("marking the exercise reported freezes its findings", async () => {
    const reported = await aliceClient
      .from("exercises")
      .update({ status: "reported" })
      .eq("id", exerciseId)
      .select("status")
      .single();
    expect(reported.error).toBeNull();
    expect(reported.data?.status).toBe("reported");

    const lateFinding = await aliceClient
      .from("findings")
      .insert({ exercise_id: exerciseId, kind: "strength", description: "Late" });
    expect(lateFinding.error?.code).toBe(CHECK_VIOLATION);
    const editFinding = await aliceClient
      .from("findings")
      .update({ description: "Changed" })
      .eq("exercise_id", exerciseId);
    expect(editFinding.error?.code).toBe(CHECK_VIOLATION);
  });
});

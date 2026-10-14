import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { createTestUser, deleteTestUser, type TestUser } from "../helpers/auth-users";
import { loadSupabaseTestEnv } from "../helpers/env";

// Proves the Phase 2 migrations' RLS against the hosted project with two signed-in users
// (SPEC.md section 7, Phase 2 verify): a user reaches only their own organization's rows.
const env = loadSupabaseTestEnv();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient<Database>(env.supabaseUrl, env.secretKey, options);
const anon = createClient<Database>(env.supabaseUrl, env.publishableKey, options);

const PERMISSION_DENIED = "42501";
const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";

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
  p_name: "Alpha Clinic",
  p_industry: "healthcare",
  p_headcount_band: "11-50",
  p_frameworks: ["hipaa", "soc2"],
  p_timezone: "America/New_York",
};

const SECTIONS = [{ id: "purpose", title: "Purpose", markdown: "Test", framework_refs: [] }];

let alice: TestUser;
let bob: TestUser;
let aliceClient: UserClient;
let bobClient: UserClient;
let aliceOrgId: string;
let aliceQuestionnaireId: string;
let alicePlanId: string;

beforeAll(async () => {
  [alice, bob] = await Promise.all([
    createTestUser(admin, "rls-alice"),
    createTestUser(admin, "rls-bob"),
  ]);
  [aliceClient, bobClient] = await Promise.all([signedInClient(alice), signedInClient(bob)]);
});

afterAll(async () => {
  await Promise.all([deleteTestUser(admin, alice.id), deleteTestUser(admin, bob.id)]);
});

describe("organizations and membership", () => {
  it("create_organization makes the caller the owner", async () => {
    const { data, error } = await aliceClient.rpc("create_organization", ORG);
    expect(error).toBeNull();
    aliceOrgId = data as string;

    const { data: org } = await aliceClient
      .from("organizations")
      .select("name, industry, frameworks, created_by")
      .eq("id", aliceOrgId)
      .single();
    expect(org).toEqual({
      name: "Alpha Clinic",
      industry: "healthcare",
      frameworks: ["hipaa", "soc2"],
      created_by: alice.id,
    });

    const { data: members } = await aliceClient.from("org_members").select("user_id, role");
    expect(members).toEqual([{ user_id: alice.id, role: "owner" }]);
  });

  it("an account can create only one organization", async () => {
    const { error } = await aliceClient.rpc("create_organization", { ...ORG, p_name: "Second" });
    expect(error?.code).toBe(UNIQUE_VIOLATION);
  });

  it("rejects values outside the allowed sets", async () => {
    const { error } = await bobClient.rpc("create_organization", {
      ...ORG,
      p_frameworks: ["pci_dss", "made_up"],
    });
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("the publishable key alone cannot create or read organizations", async () => {
    const { error: rpcError } = await anon.rpc("create_organization", ORG);
    expect(rpcError?.code).toBe(PERMISSION_DENIED);
    const { error } = await anon.from("organizations").select("id");
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});

describe("org-scoped rows", () => {
  it("members can add a questionnaire and a plan for their organization", async () => {
    const questionnaire = await aliceClient
      .from("questionnaires")
      .insert({ org_id: aliceOrgId, answers: { company_name: "Alpha Clinic" } })
      .select("id, updated_at")
      .single();
    expect(questionnaire.error).toBeNull();
    aliceQuestionnaireId = questionnaire.data!.id;

    const plan = await aliceClient
      .from("ir_plans")
      .insert({
        org_id: aliceOrgId,
        questionnaire_id: aliceQuestionnaireId,
        version: 1,
        sections: SECTIONS,
      })
      .select("id, status")
      .single();
    expect(plan.error).toBeNull();
    expect(plan.data?.status).toBe("draft");
    alicePlanId = plan.data!.id;
  });

  it("a second user sees none of the first user's rows", async () => {
    for (const table of ["organizations", "org_members", "questionnaires", "ir_plans"] as const) {
      const { data, error } = await bobClient.from(table).select("*");
      expect(error, table).toBeNull();
      expect(data, table).toEqual([]);
    }
  });

  it("a second user cannot write into the first user's organization", async () => {
    const insert = await bobClient
      .from("questionnaires")
      .insert({ org_id: aliceOrgId, answers: {} });
    expect(insert.error?.code).toBe(PERMISSION_DENIED);

    const planInsert = await bobClient.from("ir_plans").insert({
      org_id: aliceOrgId,
      questionnaire_id: aliceQuestionnaireId,
      version: 2,
      sections: SECTIONS,
    });
    expect(planInsert.error?.code).toBe(PERMISSION_DENIED);

    // Updates and deletes see no rows to touch, so they silently affect nothing.
    const update = await bobClient
      .from("organizations")
      .update({ name: "Taken over" })
      .eq("id", aliceOrgId)
      .select("id");
    expect(update.error).toBeNull();
    expect(update.data).toEqual([]);

    const remove = await bobClient.from("ir_plans").delete().eq("id", alicePlanId).select("id");
    expect(remove.error).toBeNull();
    expect(remove.data).toEqual([]);

    const { data: org } = await aliceClient
      .from("organizations")
      .select("name")
      .eq("id", aliceOrgId)
      .single();
    expect(org?.name).toBe("Alpha Clinic");
  });

  it("an approved plan version cannot be changed or deleted", async () => {
    const approve = await aliceClient
      .from("ir_plans")
      .update({
        status: "approved",
        approved_by_name: "Alice Owner",
        approved_at: new Date().toISOString(),
      })
      .eq("id", alicePlanId)
      .select("status")
      .single();
    expect(approve.error).toBeNull();
    expect(approve.data?.status).toBe("approved");

    const edit = await aliceClient
      .from("ir_plans")
      .update({ sections: [{ ...SECTIONS[0], markdown: "Changed" }] })
      .eq("id", alicePlanId);
    expect(edit.error?.code).toBe(CHECK_VIOLATION);

    const unapprove = await aliceClient
      .from("ir_plans")
      .update({ status: "draft", approved_by_name: null, approved_at: null })
      .eq("id", alicePlanId);
    expect(unapprove.error?.code).toBe(CHECK_VIOLATION);

    const remove = await aliceClient.from("ir_plans").delete().eq("id", alicePlanId).select("id");
    expect(remove.error).toBeNull();
    expect(remove.data).toEqual([]);
  });

  it("approval fields must travel with the status", async () => {
    const { error } = await aliceClient.from("ir_plans").insert({
      org_id: aliceOrgId,
      questionnaire_id: aliceQuestionnaireId,
      version: 2,
      sections: SECTIONS,
      status: "approved",
    });
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("deleting the author of an approved plan does not trip the approved-plan guard", async () => {
    const author = await createTestUser(admin, "rls-dana");
    const authorClient = await signedInClient(author);
    const { data: orgId } = await authorClient.rpc("create_organization", {
      ...ORG,
      p_name: "Dana Co",
    });
    const { data: questionnaire } = await authorClient
      .from("questionnaires")
      .insert({ org_id: orgId as string, answers: {} })
      .select("id")
      .single();
    const { error: planError } = await authorClient.from("ir_plans").insert({
      org_id: orgId as string,
      questionnaire_id: questionnaire!.id,
      version: 1,
      sections: SECTIONS,
      created_by: author.id,
      status: "approved",
      approved_by_name: "Dana Owner",
      approved_at: new Date().toISOString(),
    });
    expect(planError).toBeNull();

    // The foreign key nulls created_by on the approved row; that must be allowed.
    await expect(deleteTestUser(admin, author.id)).resolves.toBeUndefined();
    const { data: orgs } = await admin.from("organizations").select("id").eq("id", orgId!);
    expect(orgs).toEqual([]);
  });

  it("deleting the owner removes the organization and everything in it", async () => {
    const { data, error } = await bobClient.rpc("create_organization", {
      ...ORG,
      p_name: "Bob Co",
    });
    expect(error).toBeNull();
    const bobOrgId = data as string;
    await bobClient.from("questionnaires").insert({ org_id: bobOrgId, answers: {} });

    const throwaway = await createTestUser(admin, "rls-carol");
    const carolClient = await signedInClient(throwaway);
    const { data: carolOrgId } = await carolClient.rpc("create_organization", {
      ...ORG,
      p_name: "Carol Co",
    });
    await carolClient.from("questionnaires").insert({ org_id: carolOrgId as string, answers: {} });
    await deleteTestUser(admin, throwaway.id);

    const { data: orgs } = await admin.from("organizations").select("id").eq("id", carolOrgId!);
    expect(orgs).toEqual([]);
    const { data: questionnaires } = await admin
      .from("questionnaires")
      .select("id")
      .eq("org_id", carolOrgId!);
    expect(questionnaires).toEqual([]);
  });
});

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createTestUser, deleteTestUser, type TestUser } from "../helpers/auth-users";
import { loadSupabaseTestEnv } from "../helpers/env";
import answers from "../fixtures/questionnaire-answers.json";

// Phase 3 smoke test (SPEC.md section 7): the facilitator creates an exercise from a pack,
// starts it, reveals 3 injects, logs 3 decisions, adds a gap and ends it, while a
// participant in a second browser context confirms attendance and signs off. A second
// test generates the scenario from the plan with the mock provider.
const env = loadSupabaseTestEnv();
const admin = createClient(env.supabaseUrl, env.secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let user: TestUser;
let orgId: string;

test.beforeAll(async () => {
  user = await createTestUser(admin, "e2e-exercise");
  // The organization and a completed questionnaire are set up directly: onboarding and the
  // questionnaire have their own test, and "generate from my plan" needs the answers.
  const { data: org, error } = await admin
    .from("organizations")
    .insert({
      name: "E2E Drill Co",
      industry: "healthcare",
      headcount_band: "11-50",
      frameworks: ["hipaa", "soc2"],
      timezone: "America/New_York",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw error;
  orgId = org.id;
  await admin.from("org_members").insert({ org_id: orgId, user_id: user.id, role: "owner" });
  await admin.from("questionnaires").insert({
    org_id: orgId,
    answers,
    completed_at: new Date().toISOString(),
    created_by: user.id,
  });
});

test.afterAll(async () => {
  if (user) await deleteTestUser(admin, user.id);
});

async function signIn(page: Page, next: string): Promise<void> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  if (error) throw error;
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink&next=${next}`,
  );
}

async function logDecision(page: Page, decision: string) {
  const form = page.getByTestId("decision-form");
  await form.getByLabel("Decision").fill(decision);
  await form.getByRole("button", { name: "Log decision" }).click();
  await expect(page.getByTestId("decision-entry").filter({ hasText: decision })).toBeVisible();
}

test("facilitator runs an exercise while a participant follows along and signs off", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  await signIn(page, "/app/exercises/new");
  await expect(page.getByRole("heading", { name: "New exercise" })).toBeVisible();

  // Create from a pack with two participants.
  await page.getByLabel("Exercise title").fill("E2E ransomware drill");
  await page.getByLabel("Scenario pack", { exact: true }).selectOption({ index: 1 });
  await page.locator('input[name="participantName"]').nth(0).fill("Pat Lee");
  await page.locator('input[name="participantRole"]').nth(0).fill("CEO");
  await page.locator('input[name="participantName"]').nth(1).fill("Sam Ng");
  await page.locator('input[name="participantRole"]').nth(1).fill("IT Manager");
  await page.getByRole("button", { name: "Create exercise" }).click();

  await expect(page).toHaveURL(/\/app\/exercises\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("exercise-status")).toHaveText("Scheduled");
  await expect(page.getByTestId("participant-row")).toHaveCount(2);
  const participantUrl = (await page.getByTestId("participant-link").first().textContent())!.trim();
  expect(participantUrl).toMatch(/\/x\/[A-Za-z0-9_-]{43}$/);

  // The participant opens their link before the start.
  const participantContext = await browser.newContext();
  const participant = await participantContext.newPage();
  await participant.goto(participantUrl);
  await expect(participant.getByTestId("participant-identity")).toContainText("Pat Lee");
  await expect(participant.getByText("Waiting for the facilitator to start")).toBeVisible();
  await participant.getByRole("button", { name: "I'm here" }).click();
  await expect(participant.getByTestId("attended")).toBeVisible();

  // Start, then reveal three injects and log three decisions.
  await page.getByTestId("start-exercise").click();
  await expect(page).toHaveURL(/\/run$/);
  await expect(page.getByTestId("exercise-status")).toHaveText("Live");
  await expect(page.getByTestId("timer")).toBeVisible();

  for (let n = 1; n <= 3; n += 1) {
    await page.getByTestId("reveal-next").click();
    await expect(page.getByTestId("current-inject").getByRole("heading", { level: 2 })).toHaveText(
      new RegExp(`Inject ${n} of`),
    );
    await logDecision(page, `Decision ${n}: contain and tell the Executive Sponsor.`);
  }
  await expect(page.getByTestId("decision-entry")).toHaveCount(3);

  // The participant sees the third inject (their page polls every five seconds).
  await expect(participant.getByTestId("participant-inject")).toContainText("Step 3 of", {
    timeout: 15_000,
  });
  await expect(participant.getByText("Expected actions")).toHaveCount(0);

  // A gap, then end the exercise.
  await page.getByTestId("add-gap").click();
  await page
    .getByTestId("finding-form")
    .getByLabel("Description")
    .fill("Nobody could approve taking the server offline.");
  await page
    .getByTestId("finding-form")
    .getByRole("button", { name: /Add gap/ })
    .click();
  await expect(page.getByTestId("finding-gap")).toHaveCount(1);

  await page.getByTestId("end-exercise").click();
  await page.getByTestId("confirm-end").click();
  await expect(page.getByTestId("ended-banner")).toBeVisible();
  await expect(page.getByTestId("exercise-status")).toHaveText("Ended");
  await expect(page.getByTestId("decision-form")).toHaveCount(0);

  // The participant signs off; the facilitator's roster shows it.
  await expect(participant.getByTestId("signoff-form")).toBeVisible({ timeout: 15_000 });
  await participant.getByLabel("Your full name").fill("Pat Lee");
  await participant.getByRole("button", { name: "Sign off" }).click();
  await expect(participant.getByTestId("signed-off")).toContainText("Recorded as Pat Lee");
  await expect(page.getByTestId("signoff-roster")).toContainText("Pat Lee (CEO)Signed", {
    timeout: 20_000,
  });
  await participantContext.close();

  // The record behind it: server timestamps, locked log, events per step.
  const exerciseId = page.url().match(/exercises\/([0-9a-f-]{36})/)![1];
  const { data: log } = await admin
    .from("decision_log")
    .select("logged_at, inject_index")
    .eq("exercise_id", exerciseId);
  expect(log).toHaveLength(3);
  expect(log!.map((row) => row.inject_index).sort()).toEqual([0, 1, 2]);
  const { error: lateInsert } = await admin
    .from("decision_log")
    .insert({ exercise_id: exerciseId, actor_name: "Team", decision: "Too late" });
  expect(lateInsert?.code).toBe("23514");

  const { data: events } = await admin.from("events").select("name").eq("org_id", orgId);
  const names = (events ?? []).map((row) => row.name);
  for (const expected of [
    "exercise_created",
    "exercise_started",
    "decision_logged",
    "finding_added",
    "exercise_ended",
    "participant_attended",
    "participant_signed_off",
  ]) {
    expect(names, expected).toContain(expected);
  }
  expect(names.filter((name) => name === "inject_revealed")).toHaveLength(3);
});

test("an exercise can be generated from the plan with the mock provider", async ({ page }) => {
  await signIn(page, "/app/exercises/new");
  await page.getByLabel("Exercise title").fill("Generated BEC drill");
  await page.getByLabel("Generate from my plan").check();
  await page.getByRole("radio", { name: /^Business email compromise/ }).check();
  await page.getByLabel(/Anything to focus on/).fill("The wire approval rule.");
  await page.getByRole("button", { name: "Create exercise" }).click();

  await expect(page).toHaveURL(/\/app\/exercises\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  await expect(page.getByText("(generated from your plan)")).toBeVisible();
  await expect(page.getByText("Business email compromise:")).toBeVisible();

  const { data: events } = await admin
    .from("events")
    .select("name, properties")
    .eq("org_id", orgId)
    .eq("name", "exercise_scenario_generated");
  expect(events).toHaveLength(1);
  expect(events![0].properties).toMatchObject({
    type: "bec",
    model: "mock",
    fallback_used: false,
    has_focus: true,
  });
  expect(JSON.stringify(events)).not.toContain("wire approval");
});

test("an unknown participant link shows a plain message", async ({ page }) => {
  await page.goto(`/x/${"z".repeat(43)}`);
  await expect(page.getByTestId("invalid-link")).toBeVisible();
});

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createTestUser, deleteTestUser, type TestUser } from "../helpers/auth-users";
import { loadSupabaseTestEnv } from "../helpers/env";
import { seedExercise, seedOrganization } from "../helpers/seed";

// Phase 4.5 (SPEC.md section 7): the participant flow and the facilitator console on a phone.
// playwright.config.ts runs this file in the "phone" project only (iPhone 13 size, Chromium).
const env = loadSupabaseTestEnv();
const admin = createClient(env.supabaseUrl, env.secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let user: TestUser;
let exerciseId: string;
let participantToken: string;

test.beforeAll(async () => {
  user = await createTestUser(admin, "e2e-phone");
  const { orgId } = await seedOrganization(admin, user.id, "E2E Phone Co");
  const exercise = await seedExercise(admin, {
    orgId,
    userId: user.id,
    status: "scheduled",
    title: "Phone drill",
  });
  exerciseId = exercise.id;
  participantToken = exercise.tokens[0];
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

test("a participant and a facilitator run a drill on their phones", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const viewport = page.viewportSize();
  expect(viewport?.width).toBeLessThan(500);

  // The participant confirms attendance before the start.
  // The config's context options (device, headers, baseURL) apply to new contexts too.
  const participantContext = await browser.newContext();
  const participant = await participantContext.newPage();
  await participant.goto(`/x/${participantToken}`);
  await expect(participant.getByTestId("participant-identity")).toContainText("Pat Lee");
  await participant.getByRole("button", { name: "I'm here" }).click();
  await expect(participant.getByTestId("attended")).toBeVisible();

  // The facilitator starts from the exercise page; the table of participants scrolls sideways.
  await signIn(page, `/app/exercises/${exerciseId}`);
  await expect(page.getByTestId("participants")).toBeVisible();
  const noHorizontalPageScroll = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(noHorizontalPageScroll).toBe(true);
  await page.getByTestId("start-exercise").click();
  await expect(page).toHaveURL(/\/run$/);

  // One section at a time: Scenario first, then Controls to reveal, then Log to record.
  const tabs = page.getByTestId("console-tabs");
  await expect(tabs).toBeVisible();
  await expect(page.getByTestId("current-inject")).toBeVisible();
  await expect(page.getByTestId("decision-log")).toBeHidden();
  await expect(page.getByTestId("inject-list")).toBeHidden();

  await tabs.getByRole("button", { name: "Controls" }).click();
  await expect(page.getByTestId("timer")).toBeVisible();
  await expect(page.getByTestId("current-inject")).toBeHidden();
  await page.getByTestId("reveal-next").click();
  await expect(page.getByTestId("inject-list").locator("[data-state=revealed]")).toHaveCount(1);

  await tabs.getByRole("button", { name: "Log" }).click();
  const form = page.getByTestId("decision-form");
  await expect(form).toBeVisible();
  await form.getByLabel("Decision").fill("Contain first, then call the insurer.");
  await form.getByRole("button", { name: "Log decision" }).click();
  await expect(page.getByTestId("decision-entry")).toHaveCount(1);

  await tabs.getByRole("button", { name: "Scenario" }).click();
  await expect(page.getByTestId("current-inject").getByRole("heading", { level: 2 })).toHaveText(
    /Inject 1 of/,
  );
  await expect(participant.getByTestId("participant-inject")).toContainText("Step 1 of", {
    timeout: 15_000,
  });

  // End it from Controls; the participant signs off on their phone.
  await tabs.getByRole("button", { name: "Controls" }).click();
  await page.getByTestId("end-exercise").click();
  await page.getByTestId("confirm-end").click();
  await expect(page.getByTestId("ended-banner")).toBeVisible();

  await expect(participant.getByTestId("signoff-form")).toBeVisible({ timeout: 15_000 });
  await participant.getByLabel("Your full name").fill("Pat Lee");
  await participant.getByRole("button", { name: "Sign off" }).click();
  await expect(participant.getByTestId("signed-off")).toContainText("Recorded as Pat Lee");
  await participantContext.close();
});

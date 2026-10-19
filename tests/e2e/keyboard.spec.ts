import { expect, test, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createTestUser, deleteTestUser, type TestUser } from "../helpers/auth-users";
import { loadSupabaseTestEnv } from "../helpers/env";
import { seedOrganization } from "../helpers/seed";

// Phase 4.5 (SPEC.md section 7): an exercise is created, started, run and ended without a
// pointer. Only Tab, typing, Enter and the select's type-ahead are used; every control must be
// reachable in document order and the skip link must land on the main landmark.
const env = loadSupabaseTestEnv();
const admin = createClient(env.supabaseUrl, env.secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let user: TestUser;

test.beforeAll(async () => {
  user = await createTestUser(admin, "e2e-keyboard");
  await seedOrganization(admin, user.id, "E2E Keyboard Co");
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

/** Presses Tab until the target has focus, or fails: the control is not keyboard-reachable. */
async function tabTo(page: Page, target: Locator, limit = 120): Promise<void> {
  for (let i = 0; i < limit; i += 1) {
    const focused = await target.evaluate((el) => el === document.activeElement).catch(() => false);
    if (focused) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`${target} was not reached with the Tab key`);
}

test("an exercise is created, run and ended with the keyboard alone", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page, "/app/exercises/new");
  await expect(page.getByRole("heading", { name: "New exercise" })).toBeVisible();

  // The skip link is the first stop and moves focus to the main landmark.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();

  // Create: title, a pack chosen by type-ahead, two participants, Enter on the submit button.
  await tabTo(page, page.getByLabel("Exercise title"));
  await page.keyboard.type("Keyboard drill");
  const select = page.getByLabel("Scenario pack", { exact: true });
  await tabTo(page, select);
  const firstPack = (await select.locator("option:not([disabled])").first().textContent())!;
  await page.keyboard.type(firstPack.trim().slice(0, 4));
  await expect(select).toHaveValue(/.+/);
  await tabTo(page, page.locator('input[name="participantName"]').nth(0));
  await page.keyboard.type("Pat Lee");
  await tabTo(page, page.locator('input[name="participantRole"]').nth(0));
  await page.keyboard.type("CEO");
  await tabTo(page, page.locator('input[name="participantName"]').nth(1));
  await page.keyboard.type("Sam Ng");
  await tabTo(page, page.locator('input[name="participantRole"]').nth(1));
  await page.keyboard.type("IT Manager");
  await tabTo(page, page.getByRole("button", { name: "Create exercise" }));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/app\/exercises\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("participant-row")).toHaveCount(2);

  // Start.
  await tabTo(page, page.getByTestId("start-exercise"));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/run$/);
  await expect(page.getByTestId("exercise-status")).toHaveText("Live");

  // Reveal the first inject, log a decision (Enter submits from the text field), end.
  await tabTo(page, page.getByTestId("reveal-next"));
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("current-inject").getByRole("heading", { level: 2 })).toHaveText(
    /Inject 1 of/,
  );
  await tabTo(page, page.getByTestId("decision-form").getByLabel("Decision"));
  await page.keyboard.type("Pull the network cable; call the insurer.");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("decision-entry")).toHaveCount(1);

  await tabTo(page, page.getByTestId("end-exercise"));
  await page.keyboard.press("Enter");
  await tabTo(page, page.getByTestId("confirm-end"));
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("ended-banner")).toBeVisible();
  await expect(page.getByTestId("exercise-status")).toHaveText("Ended");
});

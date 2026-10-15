import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createTestUser, deleteTestUser, type TestUser } from "../helpers/auth-users";
import { loadSupabaseTestEnv } from "../helpers/env";
import answers from "../fixtures/questionnaire-answers.json";

// Phase 2 smoke test (SPEC.md section 7): sign in, set up the organization, complete the
// questionnaire with the fixture answers, generate the plan with the mock provider, see
// 11 sections, edit, approve and export. Runs against the mock-provider server that
// playwright.config.ts starts, so no model is ever called.
const env = loadSupabaseTestEnv();
const admin = createClient(env.supabaseUrl, env.secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let user: TestUser;

test.beforeAll(async () => {
  user = await createTestUser(admin, "e2e-plan");
});

test.afterAll(async () => {
  if (user) await deleteTestUser(admin, user.id);
});

/** Signs in the way the email link would, using a token minted through the admin API. */
async function signIn(page: Page): Promise<void> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  if (error) throw error;
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink&next=/app`,
  );
}

const radio = (page: Page, name: string, value: string) =>
  page.locator(`input[name="${name}"][value="${value}"]`);

async function continueTo(page: Page, step: number) {
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByRole("heading", { name: `Step ${step} of 5` })).toBeVisible();
}

test("a founder sets up their org, answers the questionnaire, then generates, approves and exports a plan", async ({
  page,
}) => {
  // Five questionnaire steps, a generation and two downloads take longer than the default.
  test.setTimeout(180_000);
  await signIn(page);
  await expect(page).toHaveURL(/\/app\/onboarding$/);

  // Onboarding creates the organization.
  await page.getByLabel("Company name").fill("E2E Clinic");
  await page.getByLabel("Industry").selectOption("healthcare");
  await page.getByLabel("Company size").selectOption("11-50");
  await page.getByLabel("HIPAA", { exact: true }).check();
  await page.getByLabel("SOC 2", { exact: true }).check();
  await page.getByLabel("Time zone").selectOption("America/New_York");
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E Clinic");
  await expect(page.getByTestId("plan-card")).toContainText("Complete the questionnaire first");

  // Questionnaire, five steps with the fixture answers.
  await page.getByRole("link", { name: "Start questionnaire" }).click();
  await expect(page.getByRole("heading", { name: "Step 1 of 5" })).toBeVisible();
  await page.getByLabel(/Next audit/).fill(answers.next_audit_date);
  await continueTo(page, 2);

  for (const value of answers.data_types) await radio(page, "data_types", value).check();
  for (const value of answers.hosting) await radio(page, "hosting", value).check();
  await radio(page, "identity_provider", answers.identity_provider).check();
  await radio(page, "mfa_status", answers.mfa_status).check();
  await page.locator('textarea[name="key_systems"]').fill(answers.key_systems);
  await continueTo(page, 3);

  for (const [key, role] of Object.entries(answers.roles)) {
    await page.locator(`input[name="roles.${key}.title"]`).fill(role.title);
    if (role.backup) await page.locator(`input[name="roles.${key}.backup"]`).fill(role.backup);
  }
  const parties = answers.outside_parties;
  await page.locator('input[name="outside_parties.msp"]').fill(parties.msp);
  await page.locator('input[name="outside_parties.outside_counsel"]').fill(parties.outside_counsel);
  await page.locator('input[name="outside_parties.insurer_name"]').fill(parties.insurer_name);
  await page
    .locator('input[name="outside_parties.insurer_claims_phone"]')
    .fill(parties.insurer_claims_phone);
  await radio(page, "outside_parties.forensics_retainer", parties.forensics_retainer).check();
  await continueTo(page, 4);

  for (const value of answers.monitoring) await radio(page, "monitoring", value).check();
  await page.locator('input[name="backups.location"]').fill(answers.backups.location);
  await page.locator('input[name="backups.frequency"]').fill(answers.backups.frequency);
  await page
    .locator('input[name="backups.last_restore_test"]')
    .fill(answers.backups.last_restore_test);
  await radio(page, "out_of_band_channel", answers.out_of_band_channel).check();
  await page.locator('input[name="out_of_band_details"]').fill(answers.out_of_band_details);
  await radio(page, "had_incident", answers.had_incident).check();
  await page.locator('input[name="incident_type"]').fill(answers.incident_type);
  await continueTo(page, 5);

  await page
    .locator('textarea[name="customer_notification_obligations"]')
    .fill(answers.customer_notification_obligations);
  for (const value of answers.regulatory_obligations) {
    await radio(page, "regulatory_obligations", value).check();
  }
  await radio(page, "review_cadence", answers.review_cadence).check();
  // Finishing with the approver blank must stop on this step, not lose the answers.
  await page.getByRole("button", { name: "Finish questionnaire" }).click();
  await expect(page.getByText("A few answers need attention")).toBeVisible();
  await page.locator('input[name="plan_approver"]').fill(answers.plan_approver);
  await page.getByRole("button", { name: "Finish questionnaire" }).click();
  await expect(page).toHaveURL(/\/app\/plan$/);

  // Generate: ten mock sections plus the matrix, saved as version 1.
  await page.getByRole("button", { name: "Generate plan" }).click();
  await expect(page.getByTestId("plan-status")).toHaveText("Version 1 · draft", {
    timeout: 60_000,
  });
  await expect(page.getByTestId("plan-section")).toHaveCount(11);
  const matrix = page.locator('[data-section-id="notification_matrix"]');
  await expect(matrix.getByRole("heading", { level: 2 })).toContainText("Notification matrix");
  await expect(matrix.getByText("Built from your answers")).toBeVisible();

  // Edit a section and save: a new version, nothing overwritten.
  const purpose = page.getByLabel("Purpose, scope and authority (markdown)");
  await purpose.fill(`${await purpose.inputValue()}\n\nReviewed during the E2E run.`);
  await page.getByRole("button", { name: "Save as new version" }).click();
  await expect(page).toHaveURL(/v=2$/);
  await expect(page.getByTestId("plan-status")).toHaveText("Version 2 · draft");
  await expect(page.getByText("Edited", { exact: true })).toBeVisible();

  // Approve version 2 by name; it becomes read-only.
  await page.getByLabel(/Approved by/).fill("Jordan Park, CEO");
  await page.getByRole("button", { name: "Approve this version" }).click();
  await expect(page.getByTestId("plan-status")).toHaveText("Version 2 · approved");
  await expect(page.getByText(/Approved by Jordan Park, CEO on/)).toBeVisible();
  await expect(page.getByTestId("plan-section").locator("textarea")).toHaveCount(0);

  // Exports carry the version and the approval.
  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export PDF" }).click();
  const pdf = await pdfDownload;
  expect(pdf.suggestedFilename()).toBe("e2e-clinic-ir-plan-v2.pdf");
  const pdfFile = readFileSync((await pdf.path()) as string);
  expect(pdfFile.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(pdfFile.length).toBeGreaterThan(20_000);

  const docxDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export Word" }).click();
  const docx = await docxDownload;
  expect(docx.suggestedFilename()).toBe("e2e-clinic-ir-plan-v2.docx");
  const docxFile = readFileSync((await docx.path()) as string);
  expect(docxFile.subarray(0, 2).toString("latin1")).toBe("PK");
  expect(docxFile.toString("latin1")).toContain("word/document.xml");

  // The dashboard reflects the approved version.
  await page.goto("/app");
  await expect(page.getByTestId("plan-card")).toContainText(
    "Approved version 2 by Jordan Park, CEO",
  );

  // Events were logged per model call with the mock provider and the org id, no free text.
  const { data: org } = await admin
    .from("organizations")
    .select("id")
    .eq("created_by", user.id)
    .single();
  const { data: events } = await admin
    .from("events")
    .select("name, properties")
    .eq("org_id", org!.id);
  const names = (events ?? []).map((row) => row.name);
  expect(names.filter((name) => name === "plan_section_generated")).toHaveLength(10);
  for (const expected of [
    "org_created",
    "questionnaire_completed",
    "plan_generated",
    "plan_saved",
    "plan_approved",
    "plan_exported",
  ]) {
    expect(names, expected).toContain(expected);
  }
  const sectionEvent = events?.find((row) => row.name === "plan_section_generated");
  expect(sectionEvent?.properties).toMatchObject({ model: "mock", fallback_used: false });
  expect(JSON.stringify(events)).not.toContain(answers.key_systems.slice(0, 20));
});

test("a signed-out visitor is sent to the sign-in page", async ({ page }) => {
  await page.goto("/app/plan");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fplan$/);
  await expect(page.getByRole("heading", { name: "Sign in to Valmius" })).toBeVisible();
});

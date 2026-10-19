import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createTestUser, deleteTestUser, type TestUser } from "../helpers/auth-users";
import { loadSupabaseTestEnv } from "../helpers/env";
import { deleteE2ERows, testIpHash } from "../helpers/test-data";
import { seedApprovedPlan, seedExercise, seedOrganization } from "../helpers/seed";

// Phase 4.5 (SPEC.md section 7): every route passes an axe sweep for WCAG 2.2 AA, signed out,
// signed in with a populated account, and as a participant. Runs against the mock-provider
// server that playwright.config.ts starts.
const env = loadSupabaseTestEnv();
const admin = createClient(env.supabaseUrl, env.secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// The participant sweep uses the tokens the signed-in sweep seeds.
test.describe.configure({ mode: "serial" });

// Its own test IP, so the page views here never show up in the generator test's event counts.
const A11Y_IP = "203.0.113.11";
test.use({ extraHTTPHeaders: { "x-forwarded-for": A11Y_IP } });

let user: TestUser;
let scheduledId: string;
let liveId: string;
let liveToken: string;
let endedId: string;
let endedToken: string;

test.beforeAll(async () => {
  user = await createTestUser(admin, "e2e-a11y");
});

test.afterAll(async () => {
  if (user) await deleteTestUser(admin, user.id);
  await deleteE2ERows(admin, testIpHash(env.ipHashSalt, A11Y_IP));
});

/**
 * Signs in and waits for the page the session lands on. A server redirect thrown after the
 * app layout has started streaming (no organization yet, so /app sends you to onboarding)
 * finishes client-side, after load; a goto issued before it settles is aborted.
 */
async function signIn(page: Page, next: string, landsOn: RegExp): Promise<void> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  if (error) throw error;
  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink&next=${next}`,
  );
  await page.waitForURL(landsOn);
}

/** Loads a route, waits for it to settle and fails with the exact axe findings, if any. */
async function sweep(page: Page, path: string, ready?: (page: Page) => Promise<void>) {
  await page.goto(path);
  if (ready) await ready(page);
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const findings = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(" ")),
  }));
  expect(findings, `${path}\n${JSON.stringify(findings, null, 2)}`).toEqual([]);
}

test("public pages pass the axe sweep", async ({ page }) => {
  await sweep(page, "/");
  await sweep(page, "/generate");
  await sweep(page, "/login");
  await sweep(page, "/login?error=device");
  await sweep(page, "/no-such-page");
  await sweep(page, `/x/${"z".repeat(43)}`);
});

test("the signed-in pages pass the axe sweep", async ({ page }) => {
  test.setTimeout(240_000);
  await signIn(page, "/app", /\/app\/onboarding$/);
  await sweep(page, "/app/onboarding", (p) =>
    p.getByRole("heading", { name: "Tell us about your company" }).waitFor(),
  );

  const { orgId, questionnaireId } = await seedOrganization(admin, user.id, "E2E Access Co");
  await seedApprovedPlan(admin, { orgId, questionnaireId, userId: user.id });
  const scheduled = await seedExercise(admin, {
    orgId,
    userId: user.id,
    status: "scheduled",
    title: "Scheduled drill",
  });
  const live = await seedExercise(admin, {
    orgId,
    userId: user.id,
    status: "live",
    title: "Live drill",
  });
  const ended = await seedExercise(admin, {
    orgId,
    userId: user.id,
    status: "ended",
    title: "Ended drill",
  });
  scheduledId = scheduled.id;
  liveId = live.id;
  liveToken = live.tokens[0];
  endedId = ended.id;
  endedToken = ended.tokens[0];

  await sweep(page, "/app", (p) => p.getByTestId("questionnaire-card").waitFor());
  await sweep(page, "/app/questionnaire?step=1", (p) =>
    p.getByTestId("questionnaire-step").waitFor(),
  );
  await sweep(page, "/app/questionnaire?step=4", (p) =>
    p.getByTestId("questionnaire-step").waitFor(),
  );
  await sweep(page, "/app/plan", (p) => p.getByTestId("plan-section").first().waitFor());
  await sweep(page, "/app/exercises");
  await sweep(page, "/app/exercises/new", (p) =>
    p.getByRole("heading", { name: "New exercise" }).waitFor(),
  );
  await sweep(page, `/app/exercises/${scheduledId}`, (p) =>
    p.getByTestId("participants").waitFor(),
  );
  await sweep(page, `/app/exercises/${liveId}/run`, (p) => p.getByTestId("timer").waitFor());
  await sweep(page, `/app/exercises/${endedId}`, (p) => p.getByTestId("participants").waitFor());
  await sweep(page, `/app/exercises/${endedId}/run`, (p) =>
    p.getByTestId("ended-banner").waitFor(),
  );
  await sweep(page, `/app/exercises/${endedId}/report`, (p) =>
    p.getByTestId("generate-report").waitFor(),
  );
  await page.getByTestId("generate-report").click();
  await page.waitForURL(/report\?v=1/);
  await sweep(page, `/app/exercises/${endedId}/report?v=1`, (p) =>
    p.getByTestId("report-cover").waitFor(),
  );
  await sweep(page, "/app/evidence", (p) => p.getByTestId("evidence-table").waitFor());
});

test("the participant pages pass the axe sweep", async ({ page }) => {
  await sweep(page, `/x/${liveToken}`, (p) => p.getByTestId("participant-inject").waitFor());
  await sweep(page, `/x/${endedToken}`, (p) => p.getByTestId("signed-off").waitFor());
});

test("the admin leads page passes the axe sweep", async ({ browser }) => {
  const password = parseEnv(readFileSync(".env.local", "utf8")).ADMIN_PASSWORD;
  test.skip(!password, "ADMIN_PASSWORD is not set in .env.local");
  const context = await browser.newContext({
    httpCredentials: { username: "admin", password: password! },
  });
  const page = await context.newPage();
  await sweep(page, "/admin/leads", (p) => p.getByRole("heading", { name: "Leads" }).waitFor());
  await context.close();
});

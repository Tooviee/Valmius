import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { generateParticipantToken } from "@/lib/exercise/token";
import { createTestUser, deleteTestUser, type TestUser } from "../helpers/auth-users";
import { loadSupabaseTestEnv } from "../helpers/env";

// Phase 4 smoke test (SPEC.md section 7): on an ended exercise, generate the report with
// the mock provider, edit it, finalize it, download the PDF and check its SHA-256 against
// the hash shown, then see the vault row, the next-due date and the CSV. Needs the private
// `reports` Storage bucket (SUPABASE-SETUP.md section 6).
const env = loadSupabaseTestEnv();
const admin = createClient(env.supabaseUrl, env.secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// The second test amends the report the first one finalized.
test.describe.configure({ mode: "serial" });

let user: TestUser;
let orgId: string;
let exerciseId: string;

test.beforeAll(async () => {
  user = await createTestUser(admin, "e2e-report");
  const { data: org, error } = await admin
    .from("organizations")
    .insert({
      name: "E2E Report Co",
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

  const { data: pack } = await admin
    .from("scenarios")
    .select("id")
    .eq("is_pack", true)
    .eq("type", "bec")
    .limit(1)
    .single();
  const started = new Date(Date.now() - 50 * 60_000);
  const at = (minutes: number) => new Date(started.getTime() + minutes * 60_000).toISOString();
  const { data: exercise, error: exerciseError } = await admin
    .from("exercises")
    .insert({
      org_id: orgId,
      scenario_id: pack!.id,
      title: "E2E reported drill",
      status: "live",
      started_at: started.toISOString(),
      revealed_count: 3,
      reveal_times: [at(1), at(15), at(30)],
      parking_lot: "Check the wire policy.",
      facilitator_id: user.id,
    })
    .select("id")
    .single();
  if (exerciseError) throw exerciseError;
  exerciseId = exercise.id;
  const { data: participants } = await admin
    .from("exercise_participants")
    .insert([
      {
        exercise_id: exerciseId,
        name: "Pat Lee",
        role: "CEO",
        token: generateParticipantToken(),
        attended_at: at(-2),
      },
      {
        exercise_id: exerciseId,
        name: "Sam Ng",
        role: "IT Manager",
        token: generateParticipantToken(),
      },
    ])
    .select("id");
  for (const [index, decision] of ["Declare SEV1", "Stop the wire", "Call the bank"].entries()) {
    const { error: logError } = await admin.from("decision_log").insert({
      exercise_id: exerciseId,
      inject_index: index,
      actor_name: "Team",
      decision,
      created_by: user.id,
    });
    if (logError) throw logError;
  }
  await admin.from("findings").insert([
    { exercise_id: exerciseId, kind: "strength", description: "Wire stopped in time." },
    {
      exercise_id: exerciseId,
      kind: "gap",
      description: "No bank call-back rule.",
      severity: "high",
    },
    {
      exercise_id: exerciseId,
      kind: "action_item",
      description: "Write the call-back rule.",
      owner_name: "CFO",
      due_date: "2026-11-30",
    },
  ]);
  const { error: endError } = await admin
    .from("exercises")
    .update({ status: "ended", ended_at: at(45) })
    .eq("id", exerciseId);
  if (endError) throw endError;
  await admin
    .from("exercise_participants")
    .update({ signed_off_at: at(47), signature_name: "Pat Lee" })
    .eq("id", participants![0].id);
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

test("the facilitator generates, edits, finalizes and downloads the report, and the vault shows it", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signIn(page, `/app/exercises/${exerciseId}/report`);
  await expect(page.getByRole("heading", { name: "After-action report" })).toBeVisible();

  await page.getByTestId("generate-report").click();
  await expect(page).toHaveURL(/report\?v=1$/, { timeout: 60_000 });
  await expect(page.getByTestId("report-status")).toHaveText("Version 1 · draft");
  await expect(page.getByTestId("report-timeline").locator("tbody tr")).toHaveCount(3);
  await expect(page.getByTestId("report-cover")).toContainText("Facilitator");

  const closing = page.getByLabel("Facilitator's closing note (markdown)");
  await closing.fill(`${await closing.inputValue()}\n\nReviewed during the E2E run.`);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  // Every narrative section shows the narrative's origin badge.
  await expect(page.getByText("Edited", { exact: true })).toHaveCount(5);

  await page.getByTestId("finalize-report").click();
  await page.getByTestId("confirm-finalize").click();
  await expect(page.getByTestId("report-status")).toHaveText("Version 1 · final", {
    timeout: 60_000,
  });
  const shownHash = (await page.getByTestId("sha256").textContent())!.trim();
  expect(shownHash).toMatch(/^[0-9a-f]{64}$/);
  await expect(page.getByTestId("report-editor").locator("textarea")).toHaveCount(0);

  // The downloaded file hashes to what the page shows.
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("download-report").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("e2e-report-co-e2e-reported-drill-after-action-v1.pdf");
  const file = readFileSync((await download.path()) as string);
  expect(file.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(createHash("sha256").update(file).digest("hex")).toBe(shownHash);

  // Finalizing reported the exercise and froze its findings.
  const { data: exercise } = await admin
    .from("exercises")
    .select("status")
    .eq("id", exerciseId)
    .single();
  expect(exercise?.status).toBe("reported");
  const { error: lateFinding } = await admin
    .from("findings")
    .insert({ exercise_id: exerciseId, kind: "strength", description: "Late" });
  expect(lateFinding?.code).toBe("23514");

  // The vault: the row with PDF and hash, the next test due a year after the end.
  await page.goto("/app/evidence");
  const row = page.getByTestId("evidence-row").filter({ hasText: "E2E reported drill" });
  await expect(row).toContainText("Reported");
  await expect(row).toContainText("PDF v1");
  await expect(row).toContainText(shownHash.slice(0, 12));
  const dueText = (await page.getByTestId("next-due").textContent())!;
  const expectedYear = new Date().getUTCFullYear() + 1;
  expect(dueText).toContain(String(expectedYear));

  const csv = await page.request.get("/app/evidence/export");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const body = await csv.text();
  expect(body.split("\r\n")[0]).toContain("report_sha256");
  expect(body).toContain(shownHash);

  await page.goto(`/app/exercises/${exerciseId}`);
  await expect(page.getByTestId("open-report")).toHaveText("After-action report");

  const { data: events } = await admin
    .from("events")
    .select("name, properties")
    .eq("org_id", orgId);
  const names = (events ?? []).map((row) => row.name);
  for (const expected of [
    "report_generated",
    "report_finalized",
    "report_downloaded",
    "evidence_exported",
  ]) {
    expect(names, expected).toContain(expected);
  }
  const generated = events?.find((row) => row.name === "report_generated");
  expect(generated?.properties).toMatchObject({ model: "mock", fallback_used: false });
});

test("an amended report is a new draft while the final stays on file", async ({ page }) => {
  await signIn(page, `/app/exercises/${exerciseId}/report`);
  await expect(page.getByTestId("report-status")).toHaveText("Version 1 · final");
  await page.getByRole("button", { name: "Amend" }).click();
  await expect(page).toHaveURL(/report\?v=2$/);
  await expect(page.getByTestId("report-status")).toHaveText("Version 2 · draft");
  await expect(page.getByRole("navigation", { name: "Report versions" })).toContainText("v1 ✓");
  await expect(page.getByTestId("report-editor").locator("textarea")).toHaveCount(5);
});

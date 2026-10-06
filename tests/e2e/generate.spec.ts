import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadSupabaseTestEnv } from "../helpers/env";
import { E2E_EMAIL_DOMAIN, testIpHash } from "../helpers/test-data";

// Runs against the server playwright.config.ts starts with LLM_PROVIDER=mock, so the
// scenario on the page is the ransomware fixture from tests/fixtures/llm.
const env = loadSupabaseTestEnv();
const supabase = createClient(env.supabaseUrl, env.secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ipHash = testIpHash(env.ipHashSalt);

test("a visitor generates a scenario, leaves an email and downloads the PDF", async ({ page }) => {
  await page.goto("/generate");
  await expect(
    page.getByRole("heading", { name: "Generate a tabletop exercise scenario" }),
  ).toBeVisible();

  await page.getByLabel("Industry").selectOption("healthcare");
  await page.getByLabel("Company size").selectOption("51-200");
  await page.getByLabel("AWS", { exact: true }).check();
  await page.getByLabel("On-prem servers").check();
  await page.getByRole("radio", { name: /^Ransomware/ }).check();
  await page.getByLabel(/Anything else we should know/).fill("Two clinics share one file server.");
  await page.getByRole("button", { name: "Generate scenario" }).click();

  const scenario = page.getByTestId("scenario");
  await expect(scenario).toBeVisible({ timeout: 30_000 });
  await expect(scenario.getByRole("heading", { level: 2 })).toContainText(/ransomware/i);
  expect(await page.getByTestId("inject").count()).toBeGreaterThanOrEqual(4);

  // The form keeps the visitor's choices so they can tweak and regenerate.
  await expect(page.getByLabel("Industry")).toHaveValue("healthcare");
  await expect(page.getByLabel("Company size")).toHaveValue("51-200");
  await expect(page.getByLabel("AWS", { exact: true })).toBeChecked();
  await expect(page.getByRole("radio", { name: /^Ransomware/ })).toBeChecked();
  await expect(page.getByLabel(/Anything else we should know/)).toHaveValue(
    "Two clinics share one file server.",
  );

  const email = `smoke-${Date.now()}@${E2E_EMAIL_DOMAIN}`;
  await page.getByLabel("Work email").fill(email);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("drill-day-ransomware-scenario.pdf");
  const file = readFileSync((await download.path()) as string);
  expect(file.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(file.length).toBeGreaterThan(5_000);
  await expect(page.getByText("Your download has started.")).toBeVisible();

  // The lead was stored with the form context, and the address is not in any event.
  const { data: lead } = await supabase
    .from("leads")
    .select("source, industry, headcount_band, scenario_type")
    .eq("email", email)
    .single();
  expect(lead).toEqual({
    source: "generator",
    industry: "healthcare",
    headcount_band: "51-200",
    scenario_type: "ransomware",
  });

  // Every Phase 1 event was logged, and the generation came from the mock provider.
  await expect
    .poll(async () => {
      const { data } = await supabase.from("events").select("name").eq("ip_hash", ipHash);
      return (data ?? []).map((row) => row.name).sort();
    })
    .toEqual(["email_submitted", "generator_viewed", "pdf_downloaded", "scenario_generated"]);

  const { data: events } = await supabase
    .from("events")
    .select("name, properties")
    .eq("ip_hash", ipHash);
  const generated = events?.find((row) => row.name === "scenario_generated");
  expect(generated?.properties).toMatchObject({
    type: "ransomware",
    industry: "healthcare",
    model: "mock",
    input_tokens: 0,
    output_tokens: 0,
    attempts: 1,
    fallback_used: false,
    has_context: true,
  });
  expect(JSON.stringify(events)).not.toContain(email);
});

test("the landing page captures a launch signup", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("incident response plan");
  await expect(page.getByText(/\$/)).toHaveCount(0);

  const email = `landing-${Date.now()}@${E2E_EMAIL_DOMAIN}`;
  await page.getByLabel("Work email").fill(email);
  await page.getByRole("button", { name: "Notify me", exact: true }).click();
  await expect(page.getByText("Thanks. We will email you when Drill Day launches.")).toBeVisible();

  const { data: lead } = await supabase.from("leads").select("source").eq("email", email).single();
  expect(lead).toEqual({ source: "landing" });
});

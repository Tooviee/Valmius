/**
 * Captures real product screenshots for the landing page and the phone views for review.
 *
 * Needs a running Valmius server with LLM_PROVIDER=mock (for example `LLM_PROVIDER=mock pnpm dev`)
 * and .env.local. Creates a throwaway account with a plan and a live exercise, signs in with a
 * minted link, takes the pictures, and deletes the account.
 *
 *   pnpm screenshots            # writes public/screens/*.png and tmp/phone-*.png
 *   BASE_URL=http://localhost:3100 pnpm screenshots
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { seedApprovedPlan, seedExercise, seedOrganization } from "../tests/helpers/seed";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
if (!url || !secret) throw new Error("Run with --env-file=.env.local");
const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function setup() {
  const email = `screens-${Date.now()}@e2e.drillday.test`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error) throw error;
  const userId = created.user.id;
  const { orgId, questionnaireId } = await seedOrganization(admin, userId);
  await seedApprovedPlan(admin, { orgId, questionnaireId, userId });
  const live = await seedExercise(admin, {
    orgId,
    userId,
    status: "live",
    title: "Q4 ransomware drill",
  });
  const ended = await seedExercise(admin, {
    orgId,
    userId,
    status: "ended",
    title: "Spring ransomware drill",
  });
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !link) throw linkError ?? new Error("could not mint the sign-in link");
  return {
    userId,
    email,
    exerciseId: live.id,
    endedId: ended.id,
    participantToken: live.tokens[0],
    hashedToken: link.properties.hashed_token,
  };
}

async function main() {
  mkdirSync("public/screens", { recursive: true });
  mkdirSync("tmp", { recursive: true });
  const s = await setup();
  const browser = await chromium.launch();
  try {
    const desktop = await browser.newContext({
      viewport: { width: 1400, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: "light",
    });
    const page = await desktop.newPage();
    await page.goto(
      `${baseUrl}/auth/confirm?token_hash=${s.hashedToken}&type=magiclink&next=/app/plan`,
    );
    await page.waitForURL(/\/app\/plan/);
    await page.getByTestId("plan-section").first().waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: "public/screens/plan.png",
      clip: { x: 0, y: 0, width: 1400, height: 900 },
    });

    await page.goto(`${baseUrl}/app/exercises/${s.exerciseId}/run`);
    await page.getByTestId("timer").waitFor();
    await page.screenshot({
      path: "public/screens/console.png",
      clip: { x: 0, y: 0, width: 1400, height: 900 },
    });

    await page.goto(`${baseUrl}/app/exercises/${s.endedId}/report`);
    const generate = page.getByTestId("generate-report");
    if (await generate.isVisible().catch(() => false)) {
      await generate.click();
      await page.waitForURL(/report\?v=1/);
    }
    await page.getByTestId("report-cover").waitFor();
    await page.screenshot({
      path: "public/screens/report.png",
      clip: { x: 0, y: 0, width: 1400, height: 900 },
    });
    await desktop.close();

    // Phone views for the design review.
    const phone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const p = await phone.newPage();
    const { data: link2, error: link2Error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: s.email,
    });
    if (link2Error || !link2) throw link2Error ?? new Error("could not mint the phone link");
    await p.goto(
      `${baseUrl}/auth/confirm?token_hash=${link2.properties.hashed_token}&type=magiclink&next=/app`,
    );
    await p.waitForURL(/\/app$/);
    await p.screenshot({ path: "tmp/phone-dashboard.png", fullPage: false });
    await p.goto(`${baseUrl}/app/questionnaire?step=2`);
    await p.getByTestId("questionnaire-step").waitFor();
    await p.screenshot({ path: "tmp/phone-questionnaire.png" });
    await p.goto(`${baseUrl}/app/plan`);
    await p.getByTestId("plan-section").first().waitFor();
    await p.screenshot({ path: "tmp/phone-plan.png" });
    await p.goto(`${baseUrl}/app/exercises/${s.exerciseId}/run`);
    await p.getByTestId("timer").waitFor();
    await p.screenshot({ path: "tmp/phone-console.png" });
    await p.goto(`${baseUrl}/x/${s.participantToken}`);
    await p.getByTestId("participant-identity").waitFor();
    await p.screenshot({ path: "tmp/phone-participant.png" });
    await p.goto(`${baseUrl}/`);
    await p.screenshot({ path: "tmp/phone-home.png", fullPage: true });
    await phone.close();
    console.log("wrote public/screens/{plan,console,report}.png and tmp/phone-*.png");
  } finally {
    await browser.close();
    await admin.auth.admin.deleteUser(s.userId);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

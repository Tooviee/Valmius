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
import { randomBytes } from "node:crypto";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import answers from "../tests/fixtures/questionnaire-answers.json";
import planSections from "../tests/fixtures/llm/plan-sections.json";
import { buildNotificationMatrixSection } from "../src/lib/plan/notification-matrix";
import { PLAN_SECTION_IDS, planSectionMeta } from "../src/lib/schemas/plan";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
if (!url || !secret) throw new Error("Run with --env-file=.env.local");
const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const token = () => randomBytes(32).toString("base64url");

async function setup() {
  const email = `screens-${Date.now()}@e2e.drillday.test`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error) throw error;
  const userId = created.user.id;
  const { data: org } = await admin
    .from("organizations")
    .insert({
      name: "Northwind Clinic",
      industry: "healthcare",
      headcount_band: "11-50",
      frameworks: ["hipaa", "soc2"],
      timezone: "America/New_York",
      created_by: userId,
    })
    .select("id")
    .single();
  const orgId = org!.id;
  await admin.from("org_members").insert({ org_id: orgId, user_id: userId, role: "owner" });
  const { data: questionnaire } = await admin
    .from("questionnaires")
    .insert({ org_id: orgId, answers, completed_at: new Date().toISOString(), created_by: userId })
    .select("id")
    .single();

  const sections = PLAN_SECTION_IDS.map((id) =>
    id === "notification_matrix"
      ? buildNotificationMatrixSection({
          companyName: "Northwind Clinic",
          frameworks: ["hipaa", "soc2"],
          dataTypes: answers.data_types,
          regulatoryObligations: answers.regulatory_obligations,
          customerObligations: answers.customer_notification_obligations,
          insurerName: answers.outside_parties.insurer_name,
          outsideCounsel: answers.outside_parties.outside_counsel,
          owners: {
            legal: "COO",
            executive: "CEO",
            communications: "Head of Patient Services",
            technical: "IT Manager",
          },
        })
      : {
          id,
          title: planSectionMeta(id).title,
          ...(planSections as Record<string, { markdown: string; framework_refs: string[] }>)[id],
          origin: "model",
        },
  );
  await admin.from("ir_plans").insert({
    org_id: orgId,
    questionnaire_id: questionnaire!.id,
    version: 1,
    sections,
    status: "approved",
    approved_by_name: "Jordan Park, CEO",
    approved_at: new Date().toISOString(),
    created_by: userId,
  });

  const { data: pack } = await admin
    .from("scenarios")
    .select("id")
    .eq("is_pack", true)
    .eq("type", "ransomware")
    .limit(1)
    .single();
  const started = new Date(Date.now() - 23 * 60_000);
  const at = (m: number) => new Date(started.getTime() + m * 60_000).toISOString();
  const { data: exercise } = await admin
    .from("exercises")
    .insert({
      org_id: orgId,
      scenario_id: pack!.id,
      title: "Q4 ransomware drill",
      status: "live",
      started_at: started.toISOString(),
      revealed_count: 2,
      reveal_times: [at(1), at(16)],
      parking_lot: "Check whether the MSP has after-hours cover.",
      facilitator_id: userId,
    })
    .select("id")
    .single();
  const exerciseId = exercise!.id;
  const { data: participants } = await admin
    .from("exercise_participants")
    .insert([
      {
        exercise_id: exerciseId,
        name: "Pat Lee",
        role: "CEO",
        token: token(),
        attended_at: at(-3),
      },
      {
        exercise_id: exerciseId,
        name: "Sam Ng",
        role: "IT Manager",
        token: token(),
        attended_at: at(-1),
      },
      {
        exercise_id: exerciseId,
        name: "Morgan Chen",
        role: "Head of Patient Services",
        token: token(),
        attended_at: at(0),
      },
    ])
    .select("token");
  for (const [i, d] of [
    ["Pat Lee", "Declare SEV1; Sam is Incident Commander, Morgan is Scribe", "Phone tree used"],
    ["Team", "Isolate the file server; do not power it off", "Preserve the ransom note"],
  ].entries()) {
    await admin.from("decision_log").insert({
      exercise_id: exerciseId,
      inject_index: i,
      actor_name: d[0],
      decision: d[1],
      notes: d[2],
      created_by: userId,
    });
  }
  await admin.from("findings").insert([
    { exercise_id: exerciseId, kind: "strength", description: "SEV1 declared within two minutes." },
    {
      exercise_id: exerciseId,
      kind: "gap",
      description: "Nobody could find the insurer's claims line.",
      severity: "high",
    },
  ]);

  // A second, ended exercise with a report draft, for the report screenshot.
  const { data: ended } = await admin
    .from("exercises")
    .insert({
      org_id: orgId,
      scenario_id: pack!.id,
      title: "Spring ransomware drill",
      status: "ended",
      started_at: at(-10_000),
      ended_at: at(-9_950),
      revealed_count: 4,
      reveal_times: [at(-9_999), at(-9_985), at(-9_970), at(-9_958)],
      facilitator_id: userId,
    })
    .select("id")
    .single();
  const endedId = ended!.id;
  await admin.from("exercise_participants").insert([
    {
      exercise_id: endedId,
      name: "Pat Lee",
      role: "CEO",
      token: token(),
      attended_at: at(-10_001),
      signed_off_at: at(-9_948),
      signature_name: "Pat Lee",
    },
    {
      exercise_id: endedId,
      name: "Sam Ng",
      role: "IT Manager",
      token: token(),
      attended_at: at(-10_000),
      signed_off_at: at(-9_947),
      signature_name: "Sam Ng",
    },
  ]);
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !link || !participants) throw linkError ?? new Error("setup incomplete");
  return {
    userId,
    email,
    exerciseId,
    endedId,
    participantToken: participants[0].token,
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

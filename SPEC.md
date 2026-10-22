# SPEC.md: IR Plan + Tabletop Exercise Generator (product name: Valmius; internal codename and slug `drillday`)

Version 0.1, October 2026. This is the product spec Claude Code builds from. Build one phase at a time. Do not start a phase until the previous phase's verification steps pass.

## 1. What this is

A web app for companies with 10 to 200 employees and no security team. It (1) generates a tailored written incident response (IR) plan from a short questionnaire, (2) runs facilitated tabletop exercises (a "fire drill" for the plan) with a timer, scripted injects and a timestamped decision log, and (3) produces a dated after-action report PDF that satisfies auditors (SOC 2, PCI DSS, ISO 27001, HIPAA), cyber insurers and regulators who ask "do you have an IR plan and did you test it this year?"

Why it can win: the cheapest purpose-built competitor charges $4,800 a year for two exercises. Compliance platforms (Vanta, Drata) hand customers a template and an evidence-upload slot but do not run or track exercises. Consultants charge $5,000 to $50,000 per facilitated exercise. Nobody sells a self-serve tool at $50 to $300 a month.

## 2. Users

- **Owner / Facilitator**: the person stuck with compliance at a small company (CTO, IT manager, ops lead). Creates the org, answers the questionnaire, runs exercises. Has an account.
- **Participant**: team members who join an exercise by link. No account. Confirm attendance, follow along, sign off at the end.
- **Consultant / MSP** (Phase 5, not now): manages many client orgs, white-labels reports.
- **Anonymous visitor** (Phase 1): uses the free public scenario generator; may leave an email.

## 3. MVP goals and non-goals

Goals: ship Phases 1 to 4 so one real company can generate a plan, run an exercise with 3 to 6 people, and download an after-action PDF an auditor would accept.

Non-goals for MVP (do not build): billing, email sending by the app itself (Supabase's own sign-in emails are configured, not built; see section 14, "Domain and email"), Vanta/Drata API push, multi-org consultant accounts, white-label, SSO/SAML, live multi-user realtime editing, mobile apps, storing any health data (PHI) or payment card numbers (PAN), automated detection or integration with security tools.

## 4. Tech stack

Chosen because the founder has shipped a Next.js + Supabase app before.

- Next.js (latest stable, App Router), TypeScript strict mode, Tailwind CSS, shadcn/ui components
- Supabase: Postgres, Auth (magic link; Google deferred, see section 13), Storage (PDFs). Client via `@supabase/ssr`. Migrations in `supabase/migrations/`. Row Level Security on every table from day one.
- LLM: Anthropic TypeScript SDK (`@anthropic-ai/sdk`), model `claude-sonnet-5-5` for plan and scenario generation. All LLM calls happen server-side (server actions or route handlers). Every LLM response is parsed as JSON and validated with zod; on validation failure retry once, then fall back (a seeded scenario pack for scenarios, a flagged template section for plan sections). Output schemas are sent to the API as JSON schema for constrained output, so they carry no zod transforms; cleanup happens after parsing. Construct the client with no explicit key (`new Anthropic()`), so credentials resolve from the environment (`ANTHROPIC_API_KEY` today); switching to Workload Identity Federation later is then a config change, not a code change (see section 14).
- LLM access goes through one module, `src/lib/llm/`, which exports typed functions (`generateScenario`, `generatePlanSection`, and `generateReport` in Phase 4) and picks its implementation from `LLM_PROVIDER`: `anthropic` (real API) or `mock` (returns fixtures from `tests/fixtures/llm/`). Vitest and Playwright always run with `LLM_PROVIDER=mock`. Only the manual check in each phase's Verify step uses the real API.
- PDF: `@react-pdf/renderer` (runs on Vercel serverless). DOCX export via the `docx` npm package.
- Validation: zod everywhere (forms, LLM output, route inputs).
- Tests: Vitest for unit tests, Playwright for a smoke test per phase.
- Tooling: pnpm, ESLint, Prettier. Deploy target: Vercel. Env in `.env.local`, documented in `.env.example`.

## 5. Architecture rules

- No secrets in client code. The Supabase secret key (`sb_secret_...`, env `SUPABASE_SECRET_KEY`) and the Anthropic key are server-only. The browser gets only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...`). Do not use the legacy `anon` / `service_role` JWT keys.
- The Supabase project was created with "Automatically expose new tables" OFF (the default since May 30, 2026). Every migration that creates a table must therefore include explicit `grant` statements for the roles that may reach it through the Data API, enable RLS, and add policies. Pattern: `grant select on public.t to anon, authenticated` only when the browser needs the table; `grant all on public.t to service_role` always; RLS enabled on every table; functions get `revoke execute ... from public, anon, authenticated` unless the browser must call them. See `supabase/migrations/20261006000001_phase1_schema.sql` for the reference pattern.
- The public generator (Phase 1) writes only to `leads` and `events`. Rate limit it per IP (5 generations per hour) using a Postgres counter table or Upstash Redis; add Cloudflare Turnstile if abuse appears. Signed-in actions that spend model tokens are limited per organization through the same counter (10 plan generations and 30 section rewrites an hour).
- Cap LLM input sizes (free text fields max 1,000 chars) and set `max_tokens` on every call. Log token usage per call to `events` (in mock mode log `model: "mock"` and zero tokens so the pipeline is exercised).
- Tests never spend money: no test may call the real Anthropic API. The mock provider must return fixtures that pass the same zod schemas the real provider is validated against, so a schema change breaks the fixtures and the tests together.
- Pre-generate and store 3 variants of each of the 4 scenario packs so the free generator can serve a seeded scenario with light personalization instead of a full LLM call when traffic spikes or the API fails.
- Every row has `created_at`, `created_by` where applicable. Soft-delete not needed for MVP; hard delete with cascade.
- Dates in UTC in the DB; render in the user's timezone.

## 6. Data model (Postgres, Supabase)

RLS rule for all org-scoped tables: a user can read/write a row only if `exists (select 1 from org_members where org_id = row.org_id and user_id = auth.uid())`. Implemented as the security-definer functions `public.is_org_member(org_id)` and `public.is_org_owner(org_id)` (migration `20261014000001`), which every org-scoped policy calls, so policies on `org_members` itself cannot recurse. Org data is read and written with the user's session client, so RLS is the access control; the service-role client stays with `leads`, `events` and `rate_limits`, plus the participant page, which looks a token up without a session. Tables that hang off an exercise use `public.is_exercise_member(exercise_id)` the same way. Content-guarding triggers must let two non-edits through: `created_by` being nulled when an account is deleted, and cascaded deletes, where the parent row is already gone when the child trigger fires (migration `20261015000006`). Participant access to exercises goes through a signed token on the exercise participant row, checked server-side with the service role, never via RLS bypass in the client.

```
organizations        id, name, industry, headcount_band, frameworks text[], timezone, created_by, created_at
org_members          org_id, user_id, role ('owner'|'member'), created_at
questionnaires       id, org_id, answers jsonb, completed_at, created_by, created_at, updated_at
ir_plans             id, org_id, questionnaire_id, version int, sections jsonb, status ('draft'|'approved'),
                     approved_by_name, approved_at, created_by, created_at
                     (unique on org_id + version; a trigger freezes an approved row except created_by;
                      each sections entry has id, title, markdown, framework_refs, origin)
scenarios            id, org_id (null = public pack), type ('ransomware'|'bec'|'cloud_credential'|'vendor_breach'|'custom'),
                     title, content jsonb (see schema in 8.3), framework_tags text[], is_pack bool, created_at
exercises            id, org_id, scenario_id, ir_plan_id (nullable, set null if the plan version is deleted), title,
                     scheduled_at, started_at, ended_at, status ('scheduled'|'live'|'ended'|'reported'),
                     facilitator_id, revealed_count int, reveal_times timestamptz[], parking_lot text, created_at
                     (status only moves forward; started_at and ended_at never change once set)
exercise_participants id, exercise_id, name, email (optional), role, token (unique, random 32 bytes), attended_at,
                     signed_off_at, signature_name
decision_log         id, exercise_id, inject_index int (null = not tied to an inject), logged_at (server clock),
                     actor_name, decision text, notes text, created_by
                     (a trigger allows inserts only while live and refuses every change once ended)
findings             id, exercise_id, kind ('strength'|'gap'|'action_item'), description, severity ('low'|'medium'|'high'),
                     owner_name, due_date, created_by, created_at
                     (open from start through the debrief; frozen once the exercise is reported)
reports              id, exercise_id, org_id, version int, status ('draft'|'final'), content jsonb (facts snapshot
                     plus the five narrative sections), pdf_path, sha256 (of the PDF file), generated_at, finalized_at,
                     created_by, created_at (unique on exercise_id + version; a trigger makes a final row immutable
                     and undeletable while its exercise exists; amended reports are new versions)
leads                id, email, industry, headcount_band, scenario_type, source, created_at
events               id, name, properties jsonb, ip_hash, org_id (nullable), created_at
rate_limits          key (ip_hash + window), count, window_start
```

## 7. Phases, acceptance criteria, verification

### Phase 1: Public scenario generator + landing page (lead magnet and demand test)

Status: done, verification including the real-provider manual check passed 2026-10-13.

Build:
- `/` landing page: one-sentence pitch, who it is for, the four compliance drivers (PCI DSS 12.10.2, SOC 2 CC7.4, insurer questionnaires, NYDFS 500.16), CTA to the generator, email capture for "notify me when the full product launches". Copy follows section 9.1: name the exact control IDs we evidence, use the positioning line, never claim "makes you compliant".
- `/generate`: form with industry (select), headcount band (select), hosting (multi-select: AWS, GCP, Azure, Vercel/Netlify, on-prem, SaaS only), scenario type (4 options), optional context (text, max 500 chars). Submit calls a server action that builds the prompt, calls the model, validates against the scenario zod schema, and renders the scenario: title, summary, roles, objectives, injects as a vertical timeline with discussion questions, wrap-up questions, estimated duration.
- "Download the full scenario + after-action template (PDF)" button gated by an email form. On submit: insert `leads`, log `events`, then render the PDF (scenario + blank after-action template) and trigger download. No email sending.
- Rate limiting as in section 5, using the `bump_rate_limit(p_key, p_limit, p_window_seconds)` RPC. Seeded fallback scenario per type if the LLM call fails or validation fails twice.
- Database: the Phase 1 migration already exists at `supabase/migrations/20261006000001_phase1_schema.sql` (scenarios, leads, events, rate_limits, RPCs, grants, RLS). Apply it with `supabase db push`; add new migrations rather than editing it. Write `pnpm db:seed` to insert the 4 scenario packs with the secret key.
- `events` logged: `generator_viewed`, `scenario_generated` (with type, token usage, fallback bool), `email_submitted`, `pdf_downloaded`.
- A tiny `/admin/leads` page protected by a single `ADMIN_PASSWORD` env var (basic auth) showing leads and event counts by day. Replaced by real auth in Phase 2.

Verify (all automated tests run with `LLM_PROVIDER=mock`; the Playwright config sets it):
- `pnpm typecheck`, `pnpm lint`, `pnpm test` pass. Unit tests cover: scenario zod schema accepts the 4 seeded packs and rejects a scenario missing injects; prompt builder includes all form fields; the mock provider's fixtures pass the schema; the real provider's JSON parsing and retry-then-fallback path, tested with a stubbed SDK response (never a live call); rate limiter blocks the 6th request in an hour.
- Playwright smoke: open `/generate`, fill the form, submit, see at least 4 injects rendered (from the fixture), submit an email, PDF download starts.
- `pnpm build` succeeds.
- Manual check, the only step that uses the real API: run the dev server with `LLM_PROVIDER=anthropic`, generate one scenario per type and read them; each must be specific to the chosen industry and hosting. Confirm the `events` rows show real token counts.
- Before the generator is deployed publicly, Claude Code reminds the founder to work through the launch checklist in section 14.

### Phase 2: Accounts, organizations, IR plan generator

Status: done, commits `849203e` to `a32be8a`; the founder's manual check with the real provider passed 2026-10-14.

Build:
- Supabase Auth, magic link only (Google deferred, section 13). The emailed link lands on `/auth/confirm`, which accepts both Supabase's default link (a code, same browser only) and the token-hash link from customized templates. On first login, create org (name, industry, headcount, frameworks, timezone) through the `create_organization()` RPC, one org per account in the MVP.
- Questionnaire: the 15 questions in section 8.1 in five steps. Step 1 edits the `organizations` row (question 1 and the framework list of question 2); everything else is autosaved to `questionnaires.answers` 1.5 s after a change and again on each step, with a loose schema for drafts and a strict one for completion.
- "Generate plan": a server action builds one deterministic facts object from the organization and the answers (roles with backups, severity ladder, systems, obligations, notification matrix), then writes the ten model sections of the section 8.2 outline as separate calls, five at a time; section 7 is built in code from the matrix. Each call validates, retries once, then falls back to a template section flagged `origin: "template"`. Sections carry `id`, `title`, `markdown`, `framework_refs`, `origin`. The plan page has a per-section markdown editor with a sanitized preview and "regenerate this section"; save creates a new version, nothing is overwritten.
- Approve plan: records `approved_by_name` and `approved_at`, status `approved`; the version is frozen by a database trigger and shown read-only, and a version with template sections cannot be approved.
- Export plan as PDF and DOCX, including a version/approval footer on each page. One remark-based block model feeds both renderers; the route handlers live under `/app/plan/[id]/export/` and read the plan with the user's session.

Verify: unit tests for plan schema and notification-matrix builder (section 8.2 item 7); Playwright: sign in with a test user (token minted through the Auth admin API, no email), complete questionnaire with fixture answers, generate plan, see 11 sections, edit, approve, export PDF and DOCX. RLS test: a second test user cannot read the first user's org rows (test with two Supabase clients). Manual check: one plan generated with `LLM_PROVIDER=anthropic` and read by the founder; this is what caught the output-schema bug the mock could not.

### Phase 3: Exercise runner (facilitator console)

Status: done, commits `e4b393b` to `0107a50` (2026-10-15); one real-provider scenario generated from a plan was read and verified. Decisions taken with the founder: log entries can be corrected until End exercise and are locked after it; an exercise may run against a draft plan version, with the latest approved version preferred and a warning shown for drafts.

Build:
- Create exercise: choose a scenario pack or "generate from my plan", set title and date, add up to twelve participants (name, optional email, role). Each participant gets a token link `/x/[token]`, which the facilitator copies and sends by whatever channel they use, since the MVP sends no email. Generation reuses the scenario generator with a `planContext` block built from the plan facts (no separate generator or fixture), stores the result as an org-owned scenario, and is limited to 10 an hour per organization.
- Facilitator console `/app/exercises/[id]/run`: left column scenario and current inject; center: discussion questions and a decision-log form (actor dropdown from participants plus "Team", decision text, notes); right: elapsed timer, inject list with "Reveal next inject", quick-add buttons for Strength / Gap / Action item, parking lot notes. Every log entry gets a server timestamp.
- Participant view `/x/[token]`: confirm attendance (sets `attended_at`), shows role and the currently revealed inject and questions (poll every 5 seconds; Supabase Realtime is optional, not required), and after the exercise ends shows a sign-off form (typed name as signature, sets `signed_off_at`).
- End exercise: a two-step confirmation sets status `ended`; the log is locked by a DB trigger (no inserts, updates or deletes after `ended_at`), findings stay open for the debrief, and the console turns into a read-only view with the sign-off roster. Participants poll every five seconds; the console refreshes every ten.

Verify: unit tests for timer math and log locking trigger (insert after end must fail); Playwright: facilitator starts exercise, reveals 3 injects, logs 3 decisions, adds a gap, ends; participant confirms attendance and signs off in a second browser context. Also: a database test that corrections work while live and every change is refused after the end; an e2e test that generates the scenario from the plan with the mock provider; and the manual check, one scenario generated from the real plan with the real provider and a short exercise run with the founder as a participant on a phone.

### Phase 4: After-action report + evidence vault

Status: done, commits `34c8157` to `3754d75` (2026-10-16); the founder's manual check with the real provider passed 2026-10-17. Decisions taken with the founder: a finalized report may be amended, with the earlier final kept on file and marked superseded; a report may be finalized while attendees have not signed off, and it says so.

Build:
- "Generate report": the factual sections (cover, roster with attendance and sign-off, injects used, the server-stamped decision timeline, findings, control mapping) are assembled in code from the exercise record; the model writes only five narrative sections (executive summary, what went well, gap analysis, action plan, closing) as JSON through `generateReport`, validated, retried once, then a flagged template. The facilitator edits the narrative and can regenerate it. "Finalize" re-snapshots the facts, renders the PDF (section 8.4 order), stores it in the private `reports` bucket at `<org>/<exercise>/v<n>.pdf`, computes the file's SHA-256, freezes the row and sets the exercise to `reported`, which freezes its findings. Downloads check membership with the session and redirect to a ten-minute signed URL. Generation is limited to 10 an hour per organization.
- Evidence vault `/app/evidence`: table of exercises (date, scenario, participants, status, plan version, PDF link, hash), the approved plan version, and "next test due" per framework (12 months after the last ended exercise, flagged on schedule, due within 60 days, overdue, or never tested). Export CSV.
- Plan page shows "last tested on" and links to the report; the dashboard shows the next due date.

Verify: unit tests for report schema and hash; Playwright: finalize a report, download PDF, hash in the UI matches `sha256sum` of the downloaded file; vault shows next-due date. Also: a database test that final reports are immutable and reported exercises freeze findings; an e2e amendment test; and the manual check, one report generated with the real provider on a real exercise and read by the founder.

### Phase 4.5: Design and accessibility pass (added 2026-10-19, before launch)

Direction from the founder: deep blue accent, light theme only, and the home page must be artistic, elegant and visually appealing; the app pages follow the same system but calmer. No new tables, no model calls, no dashboard steps.

Build:
- Accessibility to WCAG 2.2 AA: `@axe-core/playwright` in the e2e suite sweeping every route, including a participant page, and failing on any violation; a keyboard-only e2e test that creates, runs and ends an exercise; a skip link, labelled landmarks, visible focus on every control, live regions for save status and the timer, form errors announced, contrast fixes, and `prefers-reduced-motion` respected.
- Visual system and brand: a Valmius wordmark and mark (header, favicon, participant page, PDF brand row); a serif display face for headings over the existing sans for body; a deep blue primary and navy ink on warm white, through the theme variables, all AA; a shared page header component; loading skeletons, an error page and a not-found page; progress copy for the model waits.
- Mobile: the facilitator console becomes tabs (Scenario, Log, Controls) on narrow screens; tables on the exercise, evidence and report pages collapse or scroll without clipping; Playwright gains a phone project and the participant test runs on it.
- Landing page as a designed sales page: real product screenshots captured by `scripts/screenshots.ts` from the mock-provider server into `public/screens`, a decorative inject-timeline illustration, the four compliance drivers as a visual, copy within the section 9.1 rule.
- Recorded limit: react-pdf does not produce tagged (accessible) PDFs.

Verify: `pnpm test:e2e` includes the axe sweep (clean on every route) and the keyboard walkthrough; Lighthouse on the landing page scores 100 for accessibility and 90 or above for performance (run manually, reported); phone screenshots of the dashboard, questionnaire, plan, console and participant page come from the screenshot script; all existing suites and the build stay green. No real-provider manual check: no prompt or schema changes; the founder reviews the screens instead.

Status: built 2026-10-19, commits `b2a9574` to `394edbf`; the founder's review of the screens is the remaining step. Verification on the production build: 15 Playwright tests pass, among them the axe sweep (WCAG 2.2 AA tags, clean on 20 routes: public pages, every signed-in page with a seeded account, both participant states, the admin page), the keyboard-only drill (skip link, Tab, typing, Enter, select type-ahead) and the phone project (iPhone 13 size: participant flow plus the console panels); Lighthouse mobile 93 performance / 100 accessibility, desktop 99 / 100; unit and database suites unchanged and green. Decisions taken: light theme only (the `.dark` variables stay in `globals.css` but nothing switches to them); the facilitator console shows one of Scenario, Log or Controls under the `lg` breakpoint; a table becomes a focusable, labelled region only while it overflows; the timer announces only "next inject due" and "all revealed", never the clock; the hero and step screenshots are served at phone width on phones. Recorded limits: react-pdf PDFs are untagged (above), and headless Lighthouse numbers vary a few points between runs.

### Phase 5 (later, not in MVP)

Stripe annual plans ($600 to $1,200 per org, consultant tier), Resend email reminders at 11 months and 30 days before audit date, Vanta and Drata evidence push, consultant multi-org and white-label, SSO. Optional, only if customers ask: a dark theme (the `.dark` variables already exist in `globals.css`; nothing switches to them, and every new color pair must stay AA).

Order of work before Phase 5 starts: the section 14 domain, email and deploy steps, then one pilot company through a full plan, drill and report on the deployed site. Billing and reminders need a domain and a live site; the Vanta and Drata push needs a customer who uses one of them.

Small follow-ups queued from Phase 3, not needed for the MVP: a QR code next to each participant link on the exercise page, so people in the room scan the facilitator's screen instead of receiving a link; and an option to reuse an existing org-owned scenario when creating a new exercise, so an exercise ended by mistake can be rerun without generating again.

## 8. Content specifications

### 8.1 Questionnaire (15 questions)

Question 1 and the framework list of question 2 are columns on `organizations`, edited through questionnaire step 1. Every other answer is a key in `questionnaires.answers`, validated by `src/lib/schemas/questionnaire.ts`.

1. Company name, industry, headcount band (1-10, 11-50, 51-200, 201+), timezone.
2. Compliance obligations (multi): SOC 2, PCI DSS, HIPAA, ISO 27001, CMMC / NIST 800-171, NYDFS 500, cyber insurance only, none yet. Next audit or renewal date (optional).
3. Sensitive data handled (multi): customer PII, payment card data, health data, source code / IP, employee data, financial records.
4. Where systems run (multi): AWS, GCP, Azure, Vercel/Netlify, on-prem servers, SaaS only.
5. Identity provider and MFA status: Google Workspace, Microsoft 365, Okta, other; MFA enforced yes/no/partial.
6. Key business systems (free text, max 1,000 chars): e.g., GitHub, Slack, Salesforce, QuickBooks, Stripe.
7. Roles: who leads IT/security, who is the executive decision maker, who handles legal, who handles customer communications. Role titles required, names optional. Backup for each (optional).
8. Outside parties: MSP/MSSP, outside counsel, cyber insurer (name and policy claims phone, optional), forensics retainer (yes/no).
9. Monitoring in place (multi): EDR/antivirus, SIEM or log aggregation, cloud provider alerts, none.
10. Backups: where, how often, last successful restore test (date or "never").
11. Customer contractual notification obligations (free text, e.g., "notify within 72 hours").
12. Regulatory notification obligations known (multi): state breach laws, GDPR, HIPAA (60 days), PCI card brands, NYDFS (72 hours), SEC, none known.
13. Out-of-band communication channel if email/Slack is compromised (phone tree, Signal group, personal emails, none).
14. Incidents in the last 24 months (yes/no, type, optional).
15. Review cadence preference (annual, semi-annual, quarterly) and who approves the plan.

### 8.2 IR plan outline (11 sections)

1. Purpose, scope, authority, plan owner, version history.
2. Roles and responsibilities: Incident Commander, Technical Lead, Communications Lead, Legal/Compliance Lead, Executive Sponsor, Scribe. Filled from Q7 with backups.
3. Incident definitions and severity levels (SEV1 to SEV3) with concrete examples for this company's stack.
4. Detection and reporting: how employees report, intake channel, triage steps, who decides severity.
5. Response lifecycle aligned to NIST SP 800-61 Rev. 3 / CSF 2.0: Preparation, Detection and Analysis, Containment, Eradication and Recovery, Post-incident activity. Written for this company's systems (Q4 to Q6, Q9, Q10).
6. Communication plan: internal, customers, regulators, law enforcement, insurer, media; out-of-band channel from Q13; holding-statement templates.
7. Notification matrix: a table generated from Q2, Q3, Q11, Q12 listing each obligation, trigger, deadline and owner.
8. Evidence handling and documentation: decision log, chain of custody basics, what not to do (do not wipe, do not pay without counsel and insurer).
9. Scenario playbooks: short runbooks for ransomware, business email compromise, cloud credential compromise, vendor breach.
10. Testing and maintenance: annual tabletop at minimum (more often if Q15 says so), review triggers (major system change, incident, audit finding), approval procedure.
11. Appendices: contact list, system inventory, control mapping (section 9).

### 8.3 Scenario JSON schema (zod)

```
{
  title: string,
  type: 'ransomware'|'bec'|'cloud_credential'|'vendor_breach'|'custom',
  summary: string,
  setting: { company_profile: string, day_and_time: string, initial_signal: string },
  roles: [{ name: string, responsibilities: string }],           // 3 to 6
  objectives: string[],                                           // 3 to 5
  injects: [{                                                     // 5 to 7
    index: number, offset_minutes: number, title: string, narrative: string,
    questions: string[],                                          // 2 to 4
    expected_actions: string[],                                   // 2 to 4
    framework_refs: string[]                                      // e.g. ["PCI 12.10.2", "SOC2 CC7.4"]
  }],
  wrap_up_questions: string[],                                    // 3 to 5
  estimated_duration_minutes: number                              // 45 to 120
}
```

Scenario packs to seed (3 variants each): **Ransomware** (file server or SaaS backup encrypted, ransom note, backups questionable); **Business email compromise** (CEO-impersonation wire request to finance, then real mailbox compromise discovered); **Cloud credential compromise** (API key leaked in a public repo, unexpected cloud bill, data exfiltration question); **Vendor breach** (critical SaaS vendor announces breach, customer data possibly exposed, contractual notification clock starts).

### 8.4 After-action report outline

Cover (org, exercise title, date, duration, facilitator, plan version tested); participants with roles, attendance and sign-off status; scenario summary and injects used; decision timeline (timestamp, inject, actor, decision); strengths observed; gaps with severity; action items with owner and due date; control mapping showing which requirements this exercise evidences (section 9); attestation block with the report id, version, generation timestamp and a SHA-256 fingerprint of the report content. The PDF file's own SHA-256 cannot be printed inside the file it hashes, so it is stored on the `reports` row and shown in the evidence vault and beside the download; the attestation says so.

## 9. Compliance mapping (tag content with these)

| Framework | Reference | What it asks for |
|---|---|---|
| SOC 2 (TSC 2017) | CC7.3, CC7.4, CC7.5 | Evaluate security events, respond via a defined IR program, recover; auditors expect at least annual tabletop evidence |
| PCI DSS v4.0.1 | 12.10.1 to 12.10.7 | IR plan exists; reviewed and tested at least every 12 months (12.10.2); 24/7 personnel; training; lessons learned |
| NIST SP 800-61 Rev. 3 (Apr 2025) | whole document | Lifecycle phases, CSF 2.0 alignment |
| ISO/IEC 27001:2022 | A.5.24 to A.5.28 | IR planning and preparation, assessment, response, learning, evidence collection |
| HIPAA Security Rule | 45 CFR 164.308(a)(6) | Security incident procedures, response and reporting (2025 NPRM would add mandatory written plan and testing; not final) |
| NYDFS 23 NYCRR 500 | 500.16 | IR and BCDR plans, tested at least annually |
| CMMC 2.0 L2 / NIST 800-171 | 3.6.1 to 3.6.3 | IR capability, tracking and reporting, testing of IR capability |

### 9.1 What we actually cover (positioning, and the source for landing-page copy)

Valmius covers a small, mandatory slice of each framework: roughly 2 to 9% of controls depending on how a framework counts. That is the intended size for a one-pain-point product. Never claim more on the landing page or in sales conversations; auditors and consultants will know.

| Framework | Total controls (how counted) | Covered directly | Supported | Share |
|---|---|---|---|---|
| SOC 2 Security | 33 common criteria (5 to 8 IR controls in a typical 80 to 100 control program) | CC7.3, CC7.4, CC7.5 | CC2.2, CC2.3 (communication), CC9.1 (risk mitigation) | ~9% of criteria |
| PCI DSS v4.0.1 | ~260 requirements | 12.10.1, 12.10.2, 12.10.6 | 12.10.3 (personnel designated), 12.10.4 (training evidence) | ~1 to 2% |
| ISO/IEC 27001:2022 | 93 Annex A controls | A.5.24, A.5.26, A.5.27 | A.5.25, A.5.28 | ~5% |
| NIST CSF 2.0 | 106 subcategories | ID.IM-02 (improvements from exercises), ID.IM-04 (IR plan maintained) | 15 to 20 subcategories in Respond (RS) and Recover (RC) get their plan and evidence from us | ~2 to 4% direct |
| HIPAA Security Rule | 18 standards, ~42 implementation specs | 164.308(a)(6)(ii) response and reporting | 164.308(a)(7)(ii)(D) contingency plan testing | ~2 to 5% |
| CMMC 2.0 L2 / NIST 800-171 | 110 practices | 3.6.1, 3.6.2, 3.6.3 | none | ~3% |
| NYDFS 23 NYCRR 500 | ~23 sections | 500.16 | 500.17 (notification process) | ~4 to 8% |

Why the slice is worth paying for even though it is small:

1. **Audits are pass/fail per control.** A company with every other control done and no tested IR plan fails SOC 2 or PCI just the same. "Percent covered" is the wrong lens; "does this close a mandatory, dated control" is the right one.
2. **Nobody else automates it.** Compliance platforms (Vanta, Drata) automate most evidence collection but, by their own documentation, leave IR exercises as a manual upload. Cloud providers cannot inherit it: AWS's own CMMC Level 2 guidance classifies 21 of 110 practices (19%) as fully inheritable from AWS, all physical security, media protection and maintenance; incident response planning and testing stay on the customer side of the shared responsibility model for every cloud provider. The "AWS covers 50%" line people repeat is a rule of thumb about borrowable paperwork, not an AWS number.
3. **The price matches the share.** Companies spend $7,500 to $25,000 a year on a compliance platform. Five percent of that is $375 to $1,250, which is where the $600 to $1,200 annual price sits.

Positioning line for the landing page and sales conversations: "Your cloud provider inherits the data center. Your compliance platform automates the configuration evidence. Your team still has to practice the response. We cover that last part."

Landing-page rule: name the exact control IDs we evidence (the "Covered directly" column) and nothing broader. Do not say "SOC 2 compliant" or "makes you compliant"; say "produces the evidence auditors ask for under CC7.3 to CC7.5" and the equivalents.

Sources: [AWS Prescriptive Guidance, CMMC Level 2 on AWS](https://docs.aws.amazon.com/prescriptive-guidance/latest/cmmc-level-2-compliance-on-aws/aws-cloud-considerations.html); [Vanta help center, incident response plan](https://help.vanta.com/en/articles/11345507-how-to-approach-your-incident-response-plan-in-vanta); [Drata help, IR plan guidance](https://help.drata.com/en/articles/7885026-incident-response-plan-guidance).

## 10. LLM prompting approach

- One system prompt per generator (scenario, plan, report) stored in `src/lib/llm/prompts/*.ts`, with the JSON schema described in the prompt and enforced by zod after the call. The plan is written one section per call from a shared facts block, so roles, systems and deadlines stay consistent across sections; the notification matrix (plan section 7) is built in code, never by the model.
- Style rules in every prompt: write for a non-security reader, name the company's actual systems from the questionnaire, no generic filler, every inject must force a decision, every plan section must be actionable in the first hour of an incident.
- `claude-sonnet-5-5` rejects `temperature`; thinking is always on and `effort` is the control (`low` for scenarios and plan sections).
- Record `model`, `input_tokens`, `output_tokens`, `latency_ms`, `fallback_used` in `events` for every call.

## 11. Security and privacy requirements

- RLS on every table; a test proves cross-org reads fail.
- Participant tokens are 32 random bytes, base64url, single exercise, expire 30 days after `ended_at`. The participant page shows only the participant's own row, the revealed injects without the facilitator's expected actions, and the roster; its actions carry the token and are rate limited per IP.
- Do not collect PHI or PAN anywhere; the questionnaire asks whether the company handles them, never for the data itself. State this in the privacy page.
- Rate limit and size-limit every public endpoint. Validate every input with zod. Escape all markdown rendering (use a sanitizing renderer).
- Org owner can delete the org; cascade deletes everything including Storage PDFs. There is no delete-organization feature yet; the database cascade exists, but Storage objects are not removed by it, so the feature must delete `reports/<org id>/` objects explicitly.
- Security headers (CSP, HSTS, X-Frame-Options) via `next.config` headers.

## 12. Engineering conventions

- Folder layout: `src/app` (routes), `src/components`, `src/lib/{supabase,llm,pdf,schemas,rate-limit}`, `src/server/actions`, `supabase/migrations`, `tests/unit`, `tests/e2e`.
- Server actions for mutations; route handlers only for downloads and webhooks.
- Scripts: `pnpm dev`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build`, `pnpm db:migrate`, `pnpm db:seed`.
- Testing: `pnpm test` and `pnpm test:e2e` force `LLM_PROVIDER=mock` (set it in the Vitest and Playwright configs, not just in `.env`). Fixtures live in `tests/fixtures/llm/` (one scenario per type, the ten plan sections, one report in Phase 4). Any test that needs the real provider's behavior stubs the SDK response; a live API call inside a test is a bug. `pnpm test:db` and `pnpm test:e2e` create and delete auth users on the reserved `@e2e.drillday.test` domain through the Auth admin API, and the e2e sign-in mints its token with `generateLink`, so no email is ever sent. The Phase 3 e2e test drives the facilitator and a participant in two browser contexts. Signed-in e2e tests share the test IP, so Phase 1 event assertions filter by event name. Every phase's verification still includes one real-provider generation read by a person, because the mock cannot catch failures in converting an output schema to JSON schema.
- Conventional commits; commit at the end of each numbered build item in a phase; never commit `.env.local`.
- Keep `CLAUDE.md` short: commands, conventions, gotchas. Keep this `SPEC.md` as the source of truth; update it when a decision changes.

## 13. Open questions for the founder (answer before Phase 2)

Status 2026-10-19: Phases 1 to 4.5 are built and checked; the questions below are answered or superseded. What remains before customers is the launch checklist in section 14, in progress from 2026-10-19.

1. Product name: **Valmius**, decided 2026-10-15 (it replaced the working name Drill Day). Valmius is the display name in UI copy, PDF and Word headers, prompts and emails. `drillday` stays as the internal v0 codename: the package name, repo folder, Supabase project, Anthropic key names, migrations and the `e2e.drillday.test` test domain are never customer-facing and are not renamed. Domain: **valmius.app**, registered at Cloudflare Registrar on 2026-10-19, live on Vercel since 2026-10-22 (`valmius.com`, `.io` and `.co` were already taken; `valmuis.com`, a typo, was registered by mistake the same day and is not used). The order of mailbox and email-sending steps is in section 14, "Domain and email". Use `NEXT_PUBLIC_SITE_URL` everywhere a URL is needed rather than hardcoding one.
2. Google sign-in at launch, or magic link only? Decided 2026-10-13: magic link only. Google is deferred; adding it needs a Google Cloud OAuth client, the provider keys in Supabase and an `/auth/callback` route.
3. Pricing page in Phase 1 (price anchors shown) or hide pricing until validation data is in?
4. Will you run the first real exercise with a friendly company? If yes, which industry, so the first scenario pack variants target it.
5. Hosting region for Supabase (US East default).

## 14. Launch and ops checklist (founder tasks, not code)

Claude Code: when Phase 1 verification passes, and again before any production deploy, print this list and ask the founder which items are done. Do not perform these; they are Console and dashboard actions the founder takes.

Standing reminders (repeat whenever the trigger comes up in conversation, not only at phase boundaries):
- **Spend cap and alerts move together.** Whenever the founder mentions raising the Anthropic workspace spend limit, or a phase transition calls for it, remind them that the two email notifications are fixed dollar amounts and do not scale: set them to 50% and 80% of the new cap (for example, a $100 cap means notifications at $50 and $80). Ask for the new cap and compute the two numbers for them.
- **Auto-reload goes on at public launch.** Whenever the founder mentions deploying, launching, sharing the generator link, or going public, remind them to turn on auto-reload (first item below) if it is still off.

Domain and email, in this order (none of it is needed for local development or the Phase 2 manual check, which works with the address you log in to Supabase with):
- [x] **Register the domain.** Done 2026-10-19: `valmius.app` at Cloudflare Registrar, DNS at Cloudflare, so email routing, the sending provider's records and the Vercel records all live in one place. Keep auto-renew on and WHOIS redaction on (Cloudflare's default). The `.app` ending is HTTPS-only, which Vercel satisfies.
- [x] **Mailbox for people.** Done 2026-10-19: Cloudflare Email Routing forwards `support@valmius.app` and `jung@valmius.app` to the founder's Gmail (catch-all off), and Gmail sends as both ("Jung Ko" and "Valmius") through a Gmail app password that stays registered in the Google account. Move to Google Workspace only when real inboxes are worth the per-user fee. Keep the Supabase, Anthropic and Vercel accounts on the current address; add the Valmius address as a team member later instead of migrating.
- [x] **Custom SMTP, before anyone outside the Supabase team signs in.** Done 2026-10-22: Resend account on the founder's Gmail, domain `valmius.app` verified (records written by Resend's Cloudflare connection; DMARC `p=none` with reports to `support@` added by hand), SMTP settings in Supabase with sender `Valmius <login@valmius.app>`, email rate limit 30/hour. Original guidance: Supabase's built-in mailer delivers only to team members, a few messages an hour. Create a Resend account, add the domain and publish the DNS records it gives (SPF, DKIM, DMARC), then paste Resend's SMTP host, port, user and password into Authentication > Emails > SMTP Settings with sender `Valmius <login@valmius.app>` and a reply-to of `support@valmius.app`. Raise the email limit under Authentication > Rate Limits. Test by signing in from an address that is not on the Supabase team. The same Resend account carries the Phase 5 reminder emails.
- [x] **Sign-in email templates, right after custom SMTP.** Done 2026-10-22: Magic Link and Confirm signup point at `/auth/confirm` with the token hash, subject "Sign in to Valmius"; a sign-in from an outside address was delivered by Resend and opened on a phone that had never visited the site. Original guidance: The dashboard locks template editing until custom SMTP exists. Then, in Authentication > Emails, point the Magic Link and Confirm signup templates at `/auth/confirm` with the token hash (SUPABASE-SETUP.md section 5b), so links work from any device. Until then the app accepts Supabase's default link, which only works in the browser that requested it; that covers the manual check.
- [x] **Domain at deploy.** Done 2026-10-22: Vercel project `valmius` (hobby team, production from `master` of `Tooviee/Valmius`), `valmius.app` attached through a root CNAME at Cloudflare with the proxy off, `NEXT_PUBLIC_SITE_URL=https://valmius.app`, Supabase Site URL `https://valmius.app` with redirect URLs for `https://valmius.app/**`, `https://*.vercel.app/**` and localhost. `www.valmius.app` has no record yet; add a CNAME and a redirect to the apex if anyone types it.
- [x] **Lighthouse on the deployed landing page** (2026-10-22, headless Chrome against https://valmius.app: mobile 93 performance / 100 accessibility, desktop 100 / 100). Original guidance: in Chrome, DevTools > Lighthouse, mobile and desktop. Expect accessibility 100 and performance 90 or above (the local production build scored 93 mobile and 99 desktop on 2026-10-19); record the numbers in the Phase 4.5 status line. Headless runs vary a few points, so judge trends, not single points.

Before the free generator goes public:
- [x] **Turn on Anthropic auto-reload.** (On as of 2026-10-13.) Console > Settings > Billing > Auto-reload > Edit. Trigger: balance below $10. Reload: $25. It stays off during development on purpose (running out of prepaid credits is a cheap, recoverable stop while learning the burn rate); once strangers use the generator, a stalled API is a broken product.
- [x] Workspace spend limit is set: $50/month since 2026-10-14 (up from the $25 Phase 1 cap) with email notifications at $25 (50%) and $40 (80%). If the cap is raised later, move both notification amounts up with it (see standing reminders above).
- [x] Workspace rate limits (set 2026-10-14): Sonnet 5.5 requests capped at 20/min; unused models (Opus 5.5, Fable, Opus 5) set to the lowest value the dialog allows.
- [x] A separate `drillday-prod` API key exists for Vercel (recreated 2026-10-22 in the `drillday` Anthropic workspace, the one with the cap and rate limits, because the first one's value was never saved); the dev key stays on the laptop only. Key lifetimes: dev key is a personal key with a 90-day custom expiration; prod key is a service account key (not tied to the founder's user) with a 1-year expiration. Anthropic emails 7 days before expiry; on that email, create the replacement, deploy it, confirm requests succeed, delete the old key. Expiration cannot be changed after creation, so a lapsed key means a new key, not an extension.
- [x] Vercel env vars set 2026-10-22: `ANTHROPIC_API_KEY`, `SUPABASE_SECRET_KEY`, `ADMIN_PASSWORD` (sensitive, pasted by the founder), `IP_HASH_SALT` (generated in the browser, lives only in Vercel), `LLM_PROVIDER=anthropic`, `ANTHROPIC_MODEL`, the public Supabase URL and publishable key, `NEXT_PUBLIC_SITE_URL`. The Vercel Supabase integration was deliberately skipped.
- [x] Supabase: production URL added to Auth redirect URLs and legacy `anon` / `service_role` JWT keys disabled (both confirmed 2026-10-22).
- [x] Supabase: organization on the Pro plan since 2026-10-22 (spend cap left on), so the project stays unpaused and gets daily backups.
- [ ] Cloudflare Turnstile added to the generator form if abuse appears in `events`.

Security hardening before customers pay (founder tasks; the code side is already in place: RLS on every table with cross-org tests, server-only keys, no regulated data collected, hashed IPs, expiring participant tokens, security headers, sanitized markdown, rate limits):
- [ ] **MFA on the founder's accounts**: Supabase, Vercel, Anthropic Console, GitHub, and the registrar. These accounts are the easiest way into everything else.
- [x] **Supabase Pro with backups** (2026-10-22): daily backups come with Pro and the project no longer pauses; add point-in-time recovery once there is customer data that could not be re-created.
- [ ] **Database access**: enforce SSL on direct Postgres connections and restrict them to known addresses (Settings > Database); the app itself only uses the Data API. Run Database > Advisors (Security and Performance) after every migration and clear what they flag.
- [ ] **Keys**: legacy JWT keys disabled, the secret key present only in Vercel, dev key rotated on its 90-day schedule (see the key lifetimes above).
- [x] **Dependencies**: Dependabot configured 2026-10-22 (`.github/dependabot.yml`, weekly, minor and patch grouped) on the private GitHub repo `Tooviee/Valmius`; the local folder and package keep the `drillday` codename. Merge security updates weekly.
- [x] **`/.well-known/security.txt`** published 2026-10-22 (`public/.well-known/security.txt`, contact `support@valmius.app`, expires 2027-10-22; renew the date yearly). Answer reports within a few days.
- [ ] **Use Valmius on Valmius**: write the company's own incident response plan in the product, run a tabletop, keep the report. It is the first thing a buyer's IT manager asks about.
- [ ] **Security page** in plain language: what is stored and for how long, how an organization is deleted, subprocessors with what each sees (Supabase on AWS us-east-1, Vercel, Anthropic), the breach-notification commitment, and Anthropic's current API data-retention and training terms quoted exactly. Keep a data processing agreement template ready for the first customer who asks.
- [ ] **Penetration test** by an outside firm once there is revenue to protect; the report is the next thing buyers ask for after the security page.

Credibility, in the order the steps pay off. None of these can start before the site is deployed: compliance platforms collect their evidence from the live production accounts.
- [ ] **After deployment and the hardening list**: publish the security page (above) and fill in the Cloud Security Alliance STAR self-assessment; link both from the footer. Cost: time only. Answers most vendor questionnaires.
- [ ] **When the first enterprise prospect asks for SOC 2**: connect a compliance platform (Vanta, Drata or Secureframe, on startup pricing) to Vercel, GitHub, Supabase or AWS, Google Workspace and the laptops; use its trust page; book a CPA firm for a **SOC 2 Type I**, a point-in-time audit that takes weeks once the platform shows green. The tested IR plan from "use Valmius on Valmius" is one of the controls it checks.
- [ ] **3 to 12 months after Type I**: **SOC 2 Type II**, the same controls observed over a period. This is what larger customers and insurers mean by "SOC 2".
- [ ] **Once there is revenue to protect**: a penetration test by an outside firm; the report is requested right after the security page. (Also listed above.)
- [ ] **Only if non-US customers insist**: ISO 27001; it costs more and overlaps heavily with SOC 2.
- Not certifications, so nobody can sell them as such: HIPAA has no certificate, only a chain of signed business associate agreements and the Security Rule controls; Supabase, Vercel and AWS certifications cover their layers only and can be cited as inherited controls, not as Valmius being certified.

Before Phase 2 (accounts) goes live:
- [ ] Custom SMTP is live and the sign-in templates point at `/auth/confirm` (see "Domain and email" above); a sign-in from an outside address arrives within a minute.
- [x] Spend limit raised to $50 on 2026-10-14. Go to $100 (notifications $50 and $80) once paying customers generate plans; one plan costs roughly 38,000 input and 12,000 output tokens.
- [ ] Privacy page states that no health data or card numbers are collected.

Deferred until the platform supports it:
- [ ] **Switch Anthropic auth from the API key to Workload Identity Federation (WIF).** Today WIF supports AWS, Google Cloud, Azure, GitHub Actions, Kubernetes, SPIFFE, Okta and "Custom OIDC"; local development has no identity provider and Vercel is not a listed provider, so the app uses an API key. Revisit when (a) the app moves to AWS or GCP, or (b) Vercel's OIDC tokens are confirmed to work through the Custom OIDC tile. Migration path from the docs: configure the issuer, service account and federation rule in Console > Settings > Workload identity; set `ANTHROPIC_FEDERATION_RULE_ID`, `ANTHROPIC_ORGANIZATION_ID`, `ANTHROPIC_SERVICE_ACCOUNT_ID`, `ANTHROPIC_WORKSPACE_ID` and `ANTHROPIC_IDENTITY_TOKEN_FILE` in the deployment; unset `ANTHROPIC_API_KEY` there (it takes precedence and would silently shadow federation); then delete the prod API key. Because the client is constructed as `new Anthropic()` with no explicit key (section 4), no code changes are needed. Reference: https://platform.claude.com/docs/en/manage-claude/workload-identity-federation

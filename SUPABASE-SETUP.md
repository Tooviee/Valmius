# Supabase setup for Valmius (October 2026; the Supabase project keeps its internal name `drillday`)

## 1. Create the project

| Setting | Choose | Why |
|---|---|---|
| Organization / name | your org, `drillday` | |
| Database password | generate a long random one and store it in a password manager | needed later for `supabase link` and any direct Postgres connection |
| Region | US East (N. Virginia) | Vercel's default function region is also US East, so server-to-DB latency stays low. Your laptop's distance to the DB does not matter; the Next.js server talks to it. |
| Enable Data API | checked | supabase-js uses it |
| Automatically expose new tables | unchecked | tables stay private until a migration grants access explicitly; Supabase recommends this |
| Enable automatic RLS | checked | an event trigger turns RLS on for every new table in `public`, a safety net under our migrations |
| Postgres Type | Postgres (default) | OrioleDB is beta and not for production |
| Plan | Free to start | free projects pause after about a week with no traffic; move to Pro ($25/mo) once the generator is live and you want it always on |

The Postgres type cannot be changed later. The two security checkboxes set defaults you could change later with SQL, but set them now.

## 2. Copy the keys into `.env.local`

Dashboard > Project Settings > API Keys.

- Project URL -> `NEXT_PUBLIC_SUPABASE_URL`
- Publishable key (`sb_publishable_...`) -> `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (safe in the browser; RLS protects data)
- Secret key (`sb_secret_...`) -> `SUPABASE_SECRET_KEY` (server only; bypasses RLS)

Ignore the "Legacy" tab with long `eyJ...` JWT keys (`anon`, `service_role`). They are deprecated and being phased out by end of 2026. Once the app runs on the new keys, disable the legacy ones on that same page.

Template with every variable: `.env.example` in the repo root.

## 3. Install the CLI and apply the Phase 1 migration

```bash
pnpm add -D supabase
pnpm supabase login                      # opens the browser once
pnpm supabase init                       # creates supabase/config.toml (keep the generated file)
pnpm supabase link --project-ref <ref>   # <ref> = subdomain of your Project URL; asks for the DB password
pnpm supabase db push                    # applies supabase/migrations/*.sql to the hosted project
```

The migration file `supabase/migrations/20261006000001_phase1_schema.sql` creates `scenarios`, `leads`, `events`, `rate_limits`, the `bump_rate_limit()` RPC, all grants and RLS. The Phase 2 migrations (`20261014…`) add `organizations`, `org_members`, `questionnaires` and `ir_plans`, one table per file, with the `is_org_member()` / `is_org_owner()` helpers every org-scoped policy uses and the `create_organization()` RPC. The Phase 3 migrations (`20261015…`) add `exercises`, `exercise_participants`, `decision_log` and `findings`, the `is_exercise_member()` helper, the triggers that lock the log after an exercise ends, and member policies on org-owned `scenarios`. Because auto-expose is off, every future migration must follow the same pattern (grant to the roles that need the table, enable RLS, add policies). The pattern is documented at the top of the Phase 1 file and in SPEC.md section 5.

Running Postgres locally with `pnpm supabase start` needs Docker and is optional. Pushing migrations straight to the hosted free project is fine for the MVP.

## 4. Verify in the dashboard

- Table Editor: twelve tables exist (four from Phase 1, four from Phase 2, four from Phase 3), each shows the RLS shield as enabled.
- Database > Advisors > Security Advisor: should report no RLS warnings for `public`.
- SQL Editor sanity check (should return 0 rows, proving anon cannot read leads):
  ```sql
  set role anon; select count(*) from public.leads; reset role;
  ```
  Expected: permission denied for table leads.

## 5. Authentication (Phase 2, magic link only)

Dashboard > Authentication. The app signs people in with an emailed link and nothing else: there is no password form and Google is deferred (SPEC.md section 13, question 2). Three settings have to match the code.

### 5a. URL configuration

- Site URL: `http://localhost:3000` for now; change it to the production URL when you deploy.
- Redirect URLs: add `http://localhost:3000/**`. When you deploy, add `https://*.vercel.app/**` and `https://yourdomain.com/**` the same way. The app passes `<site>/auth/confirm` as the redirect target, and Supabase refuses any target that is not on this list.

### 5b. Email templates (locked until custom SMTP exists)

The dashboard only lets you edit the Magic Link and Confirm signup templates after custom SMTP is configured (the banner "Set up custom SMTP to edit templates"). Until then Supabase sends its default templates, and the app handles their link too:

- **Default template (now).** The emailed link goes through Supabase's verify endpoint and lands on `/auth/confirm?code=...`. The app exchanges the code using a cookie the sign-in form set, so the link must be opened in the same browser that requested it. That is fine for your own testing. No template change is needed; only the redirect URL in 5a.
- **Custom template (after custom SMTP, before outsiders sign in).** Authentication > Emails, open **Magic Link** and **Confirm signup**, and replace the `<a href="...">` with:

  ```html
  <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Sign in to Valmius</a>
  ```

  This link carries a one-time token hash that `/auth/confirm` verifies directly, so it works from any browser or device, including a phone that never visited the site. `{{ .RedirectTo }}` is the `/auth/confirm` URL the app sends; `type=email` lets one handler confirm first-time and returning addresses.

Links expire after one hour (Authentication > Sign In / Providers > Email > "Email OTP expiration") and work once.

### 5c. Who can receive the emails

Supabase's built-in mailer only delivers to the email addresses of members of your Supabase organization, and only a few messages an hour. That is enough for your own testing. Before any outside person signs in, configure custom SMTP (Authentication > Emails > SMTP Settings; Resend is the planned provider in Phase 5) and raise the rate limit under Authentication > Rate Limits.

### 5d. Providers

Sign In / Providers > Email: enabled, "Confirm email" on (the magic link doubles as confirmation). Leave Google off; adding it later needs a Google Cloud OAuth client and a `/auth/callback` route, both deferred.

### 5e. Automated tests

`pnpm test:db` and `pnpm test:e2e` create users on the reserved `@e2e.drillday.test` domain through the Auth admin API and delete them afterwards (organizations and plans cascade away). They never send email: the end-to-end test mints its sign-in token with `generateLink` and opens `/auth/confirm` directly.

## 6. Storage (Phase 4)

Create a bucket named `reports`, private (not public). The after-action PDFs go here; the app serves them through short-lived signed URLs.

## 7. Things not to do

- Never put `SUPABASE_SECRET_KEY` in a `NEXT_PUBLIC_` variable, client component, or commit.
- Never run `grant ... to anon` on `leads`, `events`, `rate_limits`, or any future table holding customer data.
- Do not edit a migration that has already been pushed; add a new one.

# Supabase setup for Drill Day (October 2026)

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

The migration file `supabase/migrations/20261006000001_phase1_schema.sql` creates `scenarios`, `leads`, `events`, `rate_limits`, the `bump_rate_limit()` RPC, all grants and RLS. Because auto-expose is off, every future migration must follow the same pattern (grant to the roles that need the table, enable RLS, add policies). The pattern is documented at the top of that file and in SPEC.md section 5.

Running Postgres locally with `pnpm supabase start` needs Docker and is optional. Pushing migrations straight to the hosted free project is fine for the MVP.

## 4. Verify in the dashboard

- Table Editor: four tables exist, each shows the RLS shield as enabled.
- Database > Advisors > Security Advisor: should report no RLS warnings for `public`.
- SQL Editor sanity check (should return 0 rows, proving anon cannot read leads):
  ```sql
  set role anon; select count(*) from public.leads; reset role;
  ```
  Expected: permission denied for table leads.

## 5. Authentication (needed in Phase 2, set it now so you do not forget)

Dashboard > Authentication.

- URL Configuration: Site URL `http://localhost:3000`; Redirect URLs add `http://localhost:3000/**`. Add your Vercel preview and production URLs the same way when you deploy (`https://*.vercel.app/**`, `https://yourdomain.com/**`).
- Sign In / Providers > Email: enabled. Keep "Confirm email" on (magic links double as confirmation). The app will have an `/auth/confirm` route handler that exchanges the token.
- Google: leave off until Phase 2; when you add it you need a Google Cloud OAuth client and you paste the client ID and secret here.
- Attack Protection: enable CAPTCHA (Cloudflare Turnstile) before launch if the free generator or sign-up gets abused.

## 6. Storage (Phase 4)

Create a bucket named `reports`, private (not public). The after-action PDFs go here; the app serves them through short-lived signed URLs.

## 7. Things not to do

- Never put `SUPABASE_SECRET_KEY` in a `NEXT_PUBLIC_` variable, client component, or commit.
- Never run `grant ... to anon` on `leads`, `events`, `rate_limits`, or any future table holding customer data.
- Do not edit a migration that has already been pushed; add a new one.

@AGENTS.md

# Drill Day

SPEC.md is the source of truth; update it when a decision changes. SPEC.md section 14 holds founder
reminders (spend cap, auto-reload, launch checklist): raise them whenever their triggers come up.

## Commands (pnpm)

- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm typecheck`, `pnpm lint`, `pnpm format`
- `pnpm test` (Vitest, offline), `pnpm test:db` (hosted Supabase; creates and deletes `@e2e.drillday.test` auth users), `pnpm test:e2e` (Playwright, builds and starts its own server on port 3100; stop `pnpm dev` first)
- `pnpm db:migrate` (supabase db push), `pnpm db:seed` (upsert the 12 scenario packs), `pnpm db:types`

## Layout

`src/app` routes (`/generate` public, `/login` + `/auth/confirm` auth, `/app/**` signed-in) ·
`src/components` · `src/lib/{auth,llm,plan,markdown,pdf,docx,rate-limit,schemas,supabase}` ·
`src/server/actions` · `src/proxy.ts` (admin basic auth + `/app` session refresh) ·
`supabase/migrations` · `tests/{unit,integration,e2e,fixtures,helpers}` · `scripts/seed.ts`

## Rules

- Every LLM call goes through `src/lib/llm/` (`generateScenario`, `generatePlanSection`) and every
  response is parsed and zod-validated against `src/lib/schemas`; one retry, then a fallback (a seeded
  pack from `src/lib/llm/packs`, or a flagged template section from `src/lib/plan/templates.ts`).
  The notification matrix (plan section 7) is built in code, never by the model.
- Tests never call the real API. Vitest and Playwright force `LLM_PROVIDER=mock`; unit tests block
  all network. The mock returns `tests/fixtures/llm` through the same validation as the real provider.
- Every new table needs its own migration with explicit grants, RLS enabled and policies
  (auto-expose is off). Functions get `revoke execute ... from public, anon, authenticated`.
  Org-scoped policies call `public.is_org_member(org_id)` / `is_org_owner(org_id)`; never edit a
  pushed migration, add a new one (see `20261014000005`).
- Org data is read and written with the user's session client (`src/lib/supabase/server.ts`), so RLS
  is the access control; `getOrgContext()` / `requireOrg()` in `src/lib/auth/session.ts` give the org.
- Secrets are server-only: `SUPABASE_SECRET_KEY` and `ANTHROPIC_API_KEY` never reach the browser.
  Only `src/lib/supabase/admin.ts` reads `leads`, `events` and `rate_limits`.
- Store the salted IP hash, never the IP. Never log email addresses or visitor free text to `events`.
- Conventional commits, one per build item. Never commit `.env.local`.

## Gotchas

- Next 16: read `node_modules/next/dist/docs` before using an API; `proxy.ts` replaced middleware.
- `claude-sonnet-5-5` rejects `temperature`; thinking is always on, `effort` is the control.
- react-pdf: no `lineHeight` on `<Page>` (it hides the dynamic page number); set it per text style in pt.
- pnpm needs install scripts allowed in `pnpm-workspace.yaml` (`allowBuilds`) for esbuild and supabase.
- Magic links only work once the Supabase email templates link to `/auth/confirm` with the token hash
  (SUPABASE-SETUP.md section 5b); the built-in mailer delivers only to Supabase team members.
- Base UI `Button` with `render={<Link/>}` must not claim to be a native button; the wrapper handles it.
- `toPdfText` trims; use `toPdfInline` for runs inside a paragraph or the spaces around bold text vanish.
- An approved `ir_plans` row is frozen by a trigger (everything except `created_by`); edits are new versions.

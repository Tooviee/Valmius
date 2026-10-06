@AGENTS.md

# Drill Day

SPEC.md is the source of truth; update it when a decision changes. SPEC.md section 14 holds founder
reminders (spend cap, auto-reload, launch checklist): raise them whenever their triggers come up.

## Commands (pnpm)

- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm typecheck`, `pnpm lint`, `pnpm format`
- `pnpm test` (Vitest, offline), `pnpm test:db` (hosted Supabase), `pnpm test:e2e` (Playwright, builds and starts its own server on port 3100)
- `pnpm db:migrate` (supabase db push), `pnpm db:seed` (upsert the 12 scenario packs), `pnpm db:types`

## Layout

`src/app` routes · `src/components` · `src/lib/{llm,pdf,rate-limit,schemas,supabase}` ·
`src/server/actions` · `src/proxy.ts` (admin basic auth) · `supabase/migrations` ·
`tests/{unit,integration,e2e,fixtures/llm,helpers}` · `scripts/seed.ts`

## Rules

- Every LLM call goes through `src/lib/llm/` (`generateScenario`) and every response is parsed and
  zod-validated against `src/lib/schemas`; one retry, then a seeded pack from `src/lib/llm/packs`.
- Tests never call the real API. Vitest and Playwright force `LLM_PROVIDER=mock`; unit tests block
  all network. The mock returns `tests/fixtures/llm` through the same validation as the real provider.
- Every new table needs its own migration with explicit grants, RLS enabled and policies
  (auto-expose is off). Functions get `revoke execute ... from public, anon, authenticated`.
- Secrets are server-only: `SUPABASE_SECRET_KEY` and `ANTHROPIC_API_KEY` never reach the browser.
  Only `src/lib/supabase/admin.ts` reads `leads`, `events` and `rate_limits`.
- Store the salted IP hash, never the IP. Never log email addresses or visitor free text to `events`.
- Conventional commits, one per build item. Never commit `.env.local`.

## Gotchas

- Next 16: read `node_modules/next/dist/docs` before using an API; `proxy.ts` replaced middleware.
- `claude-sonnet-5-5` rejects `temperature`; thinking is always on, `effort` is the control.
- react-pdf: no `lineHeight` on `<Page>` (it hides the dynamic page number); set it per text style in pt.
- pnpm needs install scripts allowed in `pnpm-workspace.yaml` (`allowBuilds`) for esbuild and supabase.

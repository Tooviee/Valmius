# Claude Code prompts for Drill Day

Keep this file in the repo. Paste the prompts into Claude Code; do not paste SPEC.md itself (Claude Code reads it from disk).

## Before the first session (one time)

1. Folder contains: `SPEC.md`, `SUPABASE-SETUP.md`, `PROMPTS.md`, `.env.example`, `supabase/migrations/20261006000001_phase1_schema.sql`. Run `git init` in it.
2. Copy `.env.example` to `.env.local` and fill every value: Supabase URL, publishable key, secret key, project ref, DB password; Anthropic API key; `ADMIN_PASSWORD` (anything); `IP_HASH_SALT` (run `openssl rand -hex 32`); leave `LLM_PROVIDER=anthropic` and `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
3. Run `npx supabase login` once. It opens the browser and stores a token on your machine so Claude Code can run `supabase link` and `supabase db push` without an interactive login.
4. Have Node 20+ and pnpm installed (`corepack enable` gives you pnpm). Install Claude Code: `npm install -g @anthropic-ai/claude-code`.
5. In the folder run `claude`, press `Shift+Tab` until the status bar shows plan mode, then paste the kickoff prompt.

No Vercel project is needed until the generator goes public (section 14 of SPEC.md).

## Kickoff prompt (Phase 1)

```
Read SPEC.md and SUPABASE-SETUP.md in full. SPEC.md is the source of truth for this project. We are building Phase 1 only in this session.

Context you can assume:
- .env.local already exists with every variable from .env.example filled in. Check that each key in .env.example is present in .env.local, but never print the values.
- The Supabase project already exists and was created with "Automatically expose new tables" OFF. The Phase 1 migration already exists at supabase/migrations/20261006000001_phase1_schema.sql. Do not rewrite it; apply it. Any new table in any phase needs explicit grants, RLS and policies (SPEC.md section 5 explains the pattern).
- I have already run `npx supabase login`, so `supabase link` and `supabase db push` can run non-interactively using SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD from .env.local.

Before writing any code:
1. Use the AskUserQuestion tool to ask me at most 5 clarifying questions. Only ask about things that change how Phase 1 gets built (the open questions in SPEC.md section 13, or anything ambiguous or that you disagree with). Do not ask about things the spec already answers.
2. Write a step-by-step implementation plan for Phase 1: the files you will create, how the LLM module and its anthropic/mock providers are structured, how tests force LLM_PROVIDER=mock, and how you will verify each step against the acceptance criteria in section 7. Wait for my approval before implementing.

When implementing:
- Scaffold exactly as sections 4 and 12 describe: pnpm, Next.js App Router, TypeScript strict, Tailwind, shadcn/ui, Supabase with @supabase/ssr, zod, Vitest, Playwright, ESLint, Prettier. Add .env.local to .gitignore before the first commit and never commit it.
- Supabase: `pnpm add -D supabase`, `pnpm supabase init` (keep the generated config.toml), `pnpm supabase link --project-ref $SUPABASE_PROJECT_REF`, `pnpm supabase db push`. Then write `pnpm db:seed` to insert the 4 scenario packs from section 8.3 using the secret key. If any of these commands needs me to do something in the Supabase dashboard, stop and tell me exactly what.
- LLM module first: the scenario zod schema, then src/lib/llm/ with generateScenario() and two providers chosen by LLM_PROVIDER: "anthropic" (@anthropic-ai/sdk, client constructed as `new Anthropic()` with no explicit key, model from ANTHROPIC_MODEL, max_tokens set, JSON parsed and validated, one retry, then seeded fallback) and "mock" (fixtures in tests/fixtures/llm/ that pass the same schema). Then the prompt builder, the server action, the /generate page, the email gate and PDF download, rate limiting via the bump_rate_limit RPC, event logging, and the /admin/leads page.
- Tests never call the real API. Set LLM_PROVIDER=mock inside the Vitest and Playwright configs. Write the unit tests and the Playwright smoke test listed under Phase 1 "Verify" in SPEC.md, run them, and also run pnpm typecheck, pnpm lint and pnpm build. Fix root causes, never suppress errors. Show me the test output.
- Commit with a conventional commit message at the end of each numbered item of your plan.
- Write a short CLAUDE.md (under 40 lines): the pnpm commands, the folder layout, the rule that all LLM calls go through src/lib/llm/ and are zod-validated, the rule that tests use the mock provider, the rule that every table needs grants plus RLS, a pointer that SPEC.md is the source of truth, and a pointer that SPEC.md section 14 holds founder reminders that you should raise when their triggers come up.
- Follow the security rules in section 11 and the architecture rules in section 5. Do not build anything from Phase 2 or later, even if it seems easy.

When Phase 1 is done: give me the list of commits, the test and build output, the exact commands to run it locally for the manual check with LLM_PROVIDER=anthropic, anything in SPEC.md you think should change based on what you learned, and print the "Before the free generator goes public" checklist from SPEC.md section 14 so I can work through it.
```

## Follow-up prompt (Phases 2 to 4)

Start a fresh session for each phase (`/clear` or a new `claude` run). Replace N.

```
Read SPEC.md, SUPABASE-SETUP.md and CLAUDE.md. Phase N-1 is complete and committed. Plan Phase N against the acceptance criteria in SPEC.md section 7, ask me at most 3 questions with the AskUserQuestion tool, and wait for approval before implementing.

Rules carried over: every new table gets its own migration file with explicit grants, RLS and policies (section 5), and the Phase 2 migration adds the organizations FK to scenarios.org_id. All LLM calls go through src/lib/llm/ with a mock provider for tests; add fixtures for any new generator. Tests never call the real API. Same commit discipline. If a step needs a change in the Supabase dashboard (for example Auth redirect URLs or a Storage bucket), stop and tell me exactly what to click. Do not touch later phases.

Check SPEC.md section 14 standing reminders: if anything in this phase triggers one (raising the spend cap, going public), remind me.

When the phase is done: commits, test and build output, the manual check steps with LLM_PROVIDER=anthropic, and any SPEC.md changes you recommend.
```

## When Claude Code goes off track

- Correct it once. If the same mistake repeats, `/clear` and restart the phase prompt with the correction added as a rule.
- `Esc` stops it mid-action; `Esc Esc` or `/rewind` restores an earlier checkpoint.
- Use `/btw` for side questions so they do not clutter the build context.

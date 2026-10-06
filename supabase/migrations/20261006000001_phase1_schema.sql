-- Phase 1 schema: public scenario generator, leads, events, rate limiting.
--
-- IMPORTANT (new Supabase default since May 30, 2026): tables in `public` are NOT
-- exposed to the Data API automatically. Every table needs explicit GRANTs to the
-- roles that may touch it through supabase-js, plus RLS and policies. Pattern used here:
--   * anon / authenticated get a grant ONLY when the browser needs the table (scenarios).
--   * service_role gets a grant on everything; the server uses the secret key.
--   * RLS is enabled on every table. A table with RLS and no policy denies anon/authenticated.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- scenarios: seeded public packs now; org-owned custom scenarios in Phase 3.
-- org_id is a plain nullable uuid for now; the FK to organizations is added in Phase 2.
-- ---------------------------------------------------------------------------
create table public.scenarios (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid,
  type            text not null check (type in ('ransomware','bec','cloud_credential','vendor_breach','custom')),
  title           text not null,
  content         jsonb not null,
  framework_tags  text[] not null default '{}',
  is_pack         boolean not null default false,
  created_at      timestamptz not null default now()
);
create index scenarios_pack_type_idx on public.scenarios (type) where is_pack;

alter table public.scenarios enable row level security;

grant select on public.scenarios to anon, authenticated;
grant all on public.scenarios to service_role;

create policy "public packs are readable by everyone"
  on public.scenarios for select
  to anon, authenticated
  using (is_pack = true and org_id is null);
-- No insert/update/delete policies: only the server (service_role) writes scenarios.

-- ---------------------------------------------------------------------------
-- leads: email captures from the free generator. Server-only.
-- ---------------------------------------------------------------------------
create table public.leads (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  industry        text,
  headcount_band  text,
  scenario_type   text,
  source          text not null default 'generator',
  created_at      timestamptz not null default now()
);
create unique index leads_email_lower_idx on public.leads (lower(email));

alter table public.leads enable row level security;
grant all on public.leads to service_role;
-- No grants and no policies for anon/authenticated: the browser never touches this table.

-- ---------------------------------------------------------------------------
-- events: product analytics and LLM usage log. Server-only. Store a salted IP hash, never the IP.
-- ---------------------------------------------------------------------------
create table public.events (
  id          bigint generated always as identity primary key,
  name        text not null,
  properties  jsonb not null default '{}',
  ip_hash     text,
  org_id      uuid,
  created_at  timestamptz not null default now()
);
create index events_name_created_idx on public.events (name, created_at desc);

alter table public.events enable row level security;
grant all on public.events to service_role;

-- ---------------------------------------------------------------------------
-- rate_limits: fixed-window counter per key (e.g. 'gen:' || ip_hash). Server-only.
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key           text primary key,
  count         integer not null default 0,
  window_start  timestamptz not null default now()
);

alter table public.rate_limits enable row level security;
grant all on public.rate_limits to service_role;

-- Atomic check-and-increment. Returns true if the request is allowed.
-- Usage from the server: supabase.rpc('bump_rate_limit', { p_key, p_limit: 5, p_window_seconds: 3600 })
create or replace function public.bump_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits as r (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set count = case
                  when r.window_start < now() - make_interval(secs => p_window_seconds) then 1
                  else r.count + 1
                end,
        window_start = case
                  when r.window_start < now() - make_interval(secs => p_window_seconds) then now()
                  else r.window_start
                end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

-- Functions are executable by PUBLIC by default in Postgres. Lock this one to the server.
revoke execute on function public.bump_rate_limit(text, integer, integer) from public, anon, authenticated;
grant  execute on function public.bump_rate_limit(text, integer, integer) to service_role;

-- Housekeeping: drop stale windows (run from a cron or on a schedule later; harmless to call anytime).
create or replace function public.purge_stale_rate_limits()
returns void
language sql
as $$
  delete from public.rate_limits where window_start < now() - interval '2 days';
$$;
revoke execute on function public.purge_stale_rate_limits() from public, anon, authenticated;
grant  execute on function public.purge_stale_rate_limits() to service_role;

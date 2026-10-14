-- Phase 2: questionnaires (SPEC.md section 6). The 15 answers (section 8.1) a plan is
-- generated from, autosaved as the founder works through the steps.

create table public.questionnaires (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  -- Validated by the app against the questionnaire zod schema; a size cap here keeps
  -- an oversized payload out of the table whatever the caller.
  answers       jsonb not null default '{}'::jsonb check (octet_length(answers::text) <= 100000),
  completed_at  timestamptz,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index questionnaires_org_id_idx on public.questionnaires (org_id, created_at desc);

-- Keeps updated_at honest whoever writes the row. Shared by later tables.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
-- Trigger functions are fired by the system, not called by clients.
revoke execute on function public.set_updated_at() from public, anon, authenticated;

create trigger questionnaires_set_updated_at
  before update on public.questionnaires
  for each row execute function public.set_updated_at();

alter table public.questionnaires enable row level security;

grant select, insert, update, delete on public.questionnaires to authenticated;
grant all on public.questionnaires to service_role;

create policy "members read their questionnaires"
  on public.questionnaires for select
  to authenticated
  using (public.is_org_member(org_id));

create policy "members add questionnaires"
  on public.questionnaires for insert
  to authenticated
  with check (public.is_org_member(org_id) and (created_by is null or created_by = auth.uid()));

create policy "members update their questionnaires"
  on public.questionnaires for update
  to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "members delete their questionnaires"
  on public.questionnaires for delete
  to authenticated
  using (public.is_org_member(org_id));

-- Phase 2: ir_plans (SPEC.md section 6). Every save is a new version; approving a version
-- freezes it, so the approved copy an auditor sees is the one that was approved.

create table public.ir_plans (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations (id) on delete cascade,
  questionnaire_id  uuid not null references public.questionnaires (id) on delete cascade,
  version           integer not null check (version >= 1),
  -- The 11 sections of SPEC.md section 8.2, validated by the app against the plan zod schema.
  sections          jsonb not null check (octet_length(sections::text) <= 400000),
  status            text not null default 'draft' check (status in ('draft', 'approved')),
  approved_by_name  text check (char_length(approved_by_name) between 1 and 120),
  approved_at       timestamptz,
  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (org_id, version),
  -- Approval fields travel together with the status.
  check ((status = 'approved') = (approved_at is not null and approved_by_name is not null))
);
create index ir_plans_org_id_idx on public.ir_plans (org_id, version desc);

-- An approved version is immutable: no edits, no un-approving. Edits go into a new version.
create or replace function public.ir_plans_guard_approved()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'approved' and new is distinct from old then
    raise exception 'an approved plan version cannot be changed; save a new version instead'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function public.ir_plans_guard_approved() from public, anon, authenticated;

create trigger ir_plans_guard_approved
  before update on public.ir_plans
  for each row execute function public.ir_plans_guard_approved();

alter table public.ir_plans enable row level security;

grant select, insert, update, delete on public.ir_plans to authenticated;
grant all on public.ir_plans to service_role;

create policy "members read their plans"
  on public.ir_plans for select
  to authenticated
  using (public.is_org_member(org_id));

create policy "members add plan versions"
  on public.ir_plans for insert
  to authenticated
  with check (public.is_org_member(org_id) and (created_by is null or created_by = auth.uid()));

create policy "members update their plans"
  on public.ir_plans for update
  to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

-- Drafts can be discarded; approved versions are evidence and stay until the org is deleted.
create policy "members delete draft plans"
  on public.ir_plans for delete
  to authenticated
  using (public.is_org_member(org_id) and status = 'draft');

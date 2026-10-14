-- Phase 2: organizations (SPEC.md section 6). The org a founder creates on first login.
--
-- Same pattern as the Phase 1 schema: auto-expose is off, so every table gets explicit
-- grants, RLS enabled and policies for exactly the access the app needs. Org-scoped
-- tables share one rule (SPEC.md section 6): a user may touch a row only if they are a
-- member of its organization. That check is is_org_member() below.
--
-- is_org_member() is SECURITY DEFINER so that policies on org_members itself cannot
-- recurse into their own policy, and plpgsql so it can be created here, before
-- org_members exists: plpgsql resolves table names when the function runs, and the
-- org_members migration is pushed in the same `supabase db push`.

create table public.organizations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) between 1 and 120),
  industry        text not null check (industry in (
                    'saas_software', 'financial_services', 'healthcare', 'ecommerce_retail',
                    'professional_services', 'manufacturing', 'education', 'nonprofit', 'other')),
  headcount_band  text not null check (headcount_band in ('1-10', '11-50', '51-200', '201+')),
  -- Compliance obligations from questionnaire question 2 (SPEC.md section 8.1).
  frameworks      text[] not null default '{}' check (frameworks <@ array[
                    'soc2', 'pci_dss', 'hipaa', 'iso_27001', 'cmmc_nist_800_171', 'nydfs_500',
                    'cyber_insurance', 'none']::text[]),
  -- An IANA zone name such as 'America/New_York'; validated in the app.
  timezone        text not null check (char_length(timezone) between 1 and 64),
  created_by      uuid not null references auth.users (id) on delete cascade,
  created_at      timestamptz not null default now()
);
create index organizations_created_by_idx on public.organizations (created_by);

-- Membership checks used by every org-scoped policy. They run as the table owner
-- (bypassing RLS on org_members), read only the caller's own membership, and return a
-- boolean, so they leak nothing about other organizations.
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.org_members m
    where m.org_id = p_org_id and m.user_id = auth.uid()
  );
end;
$$;

create or replace function public.is_org_owner(p_org_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.org_members m
    where m.org_id = p_org_id and m.user_id = auth.uid() and m.role = 'owner'
  );
end;
$$;

-- Policies evaluate these as the signed-in user, so `authenticated` must be able to call them.
revoke execute on function public.is_org_member(uuid) from public, anon;
grant  execute on function public.is_org_member(uuid) to authenticated, service_role;
revoke execute on function public.is_org_owner(uuid) from public, anon;
grant  execute on function public.is_org_owner(uuid) to authenticated, service_role;

alter table public.organizations enable row level security;

grant select, update, delete on public.organizations to authenticated;
grant all on public.organizations to service_role;
-- No insert grant for authenticated: rows are created by create_organization() (next
-- migration), which records the owner membership in the same transaction.

create policy "members read their organization"
  on public.organizations for select
  to authenticated
  using (public.is_org_member(id));

create policy "owners update their organization"
  on public.organizations for update
  to authenticated
  using (public.is_org_owner(id))
  with check (public.is_org_owner(id));

create policy "owners delete their organization"
  on public.organizations for delete
  to authenticated
  using (public.is_org_owner(id));

-- Phase 1 left org_id as a plain uuid on these tables; the foreign key arrives with the
-- table it points at. Deleting an organization removes its scenarios and anonymizes its
-- events (SPEC.md section 11: the owner can delete the org, with cascade).
alter table public.scenarios
  add constraint scenarios_org_id_fkey
  foreign key (org_id) references public.organizations (id) on delete cascade;
create index scenarios_org_id_idx on public.scenarios (org_id) where org_id is not null;

alter table public.events
  add constraint events_org_id_fkey
  foreign key (org_id) references public.organizations (id) on delete set null;
create index events_org_id_idx on public.events (org_id) where org_id is not null;

-- Phase 2: org_members (SPEC.md section 6). Who belongs to which organization, and as what.

create table public.org_members (
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null check (role in ('owner', 'member')),
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index org_members_user_id_idx on public.org_members (user_id);

alter table public.org_members enable row level security;

grant select on public.org_members to authenticated;
grant all on public.org_members to service_role;

create policy "members see who is in their organization"
  on public.org_members for select
  to authenticated
  using (public.is_org_member(org_id));
-- No insert/update/delete policies for authenticated: memberships are written only by
-- create_organization() below and, in later phases, by the server.

-- Creates the organization and records the caller as its owner in one transaction.
-- Usage from a signed-in client: supabase.rpc('create_organization', { p_name, ... })
create or replace function public.create_organization(
  p_name            text,
  p_industry        text,
  p_headcount_band  text,
  p_frameworks      text[],
  p_timezone        text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id  uuid;
begin
  if v_user_id is null then
    raise exception 'create_organization requires a signed-in user' using errcode = '42501';
  end if;

  -- One organization per account in the MVP; consultant multi-org is Phase 5.
  if exists (select 1 from public.org_members where user_id = v_user_id) then
    raise exception 'this account already belongs to an organization' using errcode = '23505';
  end if;

  -- The table's check constraints validate industry, headcount_band and frameworks.
  insert into public.organizations (name, industry, headcount_band, frameworks, timezone, created_by)
  values (p_name, p_industry, p_headcount_band, coalesce(p_frameworks, '{}'), p_timezone, v_user_id)
  returning id into v_org_id;

  insert into public.org_members (org_id, user_id, role)
  values (v_org_id, v_user_id, 'owner');

  return v_org_id;
end;
$$;

revoke execute on function public.create_organization(text, text, text, text[], text) from public, anon;
grant  execute on function public.create_organization(text, text, text, text[], text) to authenticated, service_role;

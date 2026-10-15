-- Phase 3: org-owned scenarios. Phase 1 exposed only the public packs; a scenario
-- generated from an organization's plan belongs to that organization (org_id set,
-- is_pack false) and is written through the member's own session, like all org data.

grant insert on public.scenarios to authenticated;

create policy "members read their organization's scenarios"
  on public.scenarios for select
  to authenticated
  using (org_id is not null and public.is_org_member(org_id));

create policy "members add custom scenarios"
  on public.scenarios for insert
  to authenticated
  with check (org_id is not null and public.is_org_member(org_id) and is_pack = false);
-- Still no update or delete for authenticated: a scenario that an exercise ran against
-- is part of the evidence.

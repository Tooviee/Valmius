-- Phase 4: reports (SPEC.md section 6). The after-action report for an exercise. A draft
-- holds the generated and edited content; finalizing renders the PDF into the private
-- `reports` Storage bucket, records the file's SHA-256, and freezes the row. Amended
-- versions are new rows; earlier finals stay on file (founder decision, 2026-10-15).

create table public.reports (
  id            uuid primary key default gen_random_uuid(),
  exercise_id   uuid not null references public.exercises (id) on delete cascade,
  org_id        uuid not null references public.organizations (id) on delete cascade,
  version       integer not null check (version >= 1),
  status        text not null default 'draft' check (status in ('draft', 'final')),
  -- The report as rendered: facts assembled from the database plus the narrative sections.
  content       jsonb not null check (octet_length(content::text) <= 400000),
  -- Storage object path and the SHA-256 of the PDF, set when finalized.
  pdf_path      text check (char_length(pdf_path) <= 300),
  sha256        text check (sha256 ~ '^[0-9a-f]{64}$'),
  generated_at  timestamptz not null default now(),
  finalized_at  timestamptz,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (exercise_id, version),
  check ((status = 'final') = (pdf_path is not null and sha256 is not null and finalized_at is not null))
);
create index reports_exercise_id_idx on public.reports (exercise_id, version desc);
create index reports_org_id_idx on public.reports (org_id, finalized_at desc);

-- A final report never changes (except created_by when an account is deleted) and is
-- only removed when its exercise or organization is deleted (cascade: parent already gone).
create or replace function public.reports_guard_final()
returns trigger
language plpgsql
as $$
declare
  v_parent_exists boolean;
begin
  if tg_op = 'DELETE' then
    if old.status = 'final' then
      select exists (select 1 from public.exercises where id = old.exercise_id) into v_parent_exists;
      if v_parent_exists then
        raise exception 'a final report cannot be deleted' using errcode = 'check_violation';
      end if;
    end if;
    return old;
  end if;

  if old.status = 'final' and (
    new.exercise_id  is distinct from old.exercise_id or
    new.org_id       is distinct from old.org_id or
    new.version      is distinct from old.version or
    new.status       is distinct from old.status or
    new.content      is distinct from old.content or
    new.pdf_path     is distinct from old.pdf_path or
    new.sha256       is distinct from old.sha256 or
    new.generated_at is distinct from old.generated_at or
    new.finalized_at is distinct from old.finalized_at
  ) then
    raise exception 'a final report cannot be changed; issue an amended version instead'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function public.reports_guard_final() from public, anon, authenticated;

create trigger reports_guard_final
  before update or delete on public.reports
  for each row execute function public.reports_guard_final();

alter table public.reports enable row level security;

grant select, insert, update, delete on public.reports to authenticated;
grant all on public.reports to service_role;

create policy "members read their reports"
  on public.reports for select
  to authenticated
  using (public.is_org_member(org_id));

create policy "members add report drafts"
  on public.reports for insert
  to authenticated
  with check (
    public.is_org_member(org_id)
    and public.is_exercise_member(exercise_id)
    and (created_by is null or created_by = auth.uid())
  );

create policy "members update their reports"
  on public.reports for update
  to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "members discard report drafts"
  on public.reports for delete
  to authenticated
  using (public.is_org_member(org_id) and status = 'draft');

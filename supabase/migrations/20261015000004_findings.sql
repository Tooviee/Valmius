-- Phase 3: findings (SPEC.md section 6). Strengths, gaps and action items captured during
-- the exercise and the debrief. They stay editable after the exercise ends, so the debrief
-- can add to them, and freeze once the after-action report is finalized (status reported,
-- Phase 4).

create table public.findings (
  id            uuid primary key default gen_random_uuid(),
  exercise_id   uuid not null references public.exercises (id) on delete cascade,
  kind          text not null check (kind in ('strength', 'gap', 'action_item')),
  description   text not null check (char_length(description) between 1 and 2000),
  severity      text check (severity in ('low', 'medium', 'high')),
  owner_name    text check (char_length(owner_name) <= 120),
  due_date      date,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index findings_exercise_id_idx on public.findings (exercise_id, created_at);

create or replace function public.findings_guard()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.exercises
  where id = coalesce(new.exercise_id, old.exercise_id);

  if v_status is null then
    raise exception 'unknown exercise' using errcode = 'foreign_key_violation';
  end if;
  if v_status = 'reported' then
    raise exception 'findings are frozen once the report is finalized'
      using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' and v_status = 'scheduled' then
    raise exception 'findings can be added once the exercise has started'
      using errcode = 'check_violation';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  new.exercise_id := case when tg_op = 'INSERT' then new.exercise_id else old.exercise_id end;
  return new;
end;
$$;
revoke execute on function public.findings_guard() from public, anon, authenticated;

create trigger findings_guard
  before insert or update or delete on public.findings
  for each row execute function public.findings_guard();

alter table public.findings enable row level security;

grant select, insert, update, delete on public.findings to authenticated;
grant all on public.findings to service_role;

create policy "members read findings"
  on public.findings for select
  to authenticated
  using (public.is_exercise_member(exercise_id));

create policy "members add findings"
  on public.findings for insert
  to authenticated
  with check (public.is_exercise_member(exercise_id) and (created_by is null or created_by = auth.uid()));

create policy "members update findings"
  on public.findings for update
  to authenticated
  using (public.is_exercise_member(exercise_id))
  with check (public.is_exercise_member(exercise_id));

create policy "members remove findings"
  on public.findings for delete
  to authenticated
  using (public.is_exercise_member(exercise_id));

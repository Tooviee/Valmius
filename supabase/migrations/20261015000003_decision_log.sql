-- Phase 3: decision_log (SPEC.md section 6). The timestamped record of what the group
-- decided. logged_at is always the database clock (SPEC: every entry gets a server
-- timestamp), entries can be corrected while the exercise is live, and the whole log is
-- locked the moment the exercise ends (founder decision, 2026-10-14).

create table public.decision_log (
  id            uuid primary key default gen_random_uuid(),
  exercise_id   uuid not null references public.exercises (id) on delete cascade,
  -- Null for an entry that is not tied to an inject (for example before the first one).
  inject_index  integer check (inject_index >= 0),
  logged_at     timestamptz not null default now(),
  actor_name    text not null check (char_length(actor_name) between 1 and 120),
  decision      text not null check (char_length(decision) between 1 and 2000),
  notes         text not null default '' check (char_length(notes) <= 2000),
  created_by    uuid references auth.users (id) on delete set null
);
create index decision_log_exercise_id_idx on public.decision_log (exercise_id, logged_at);

create or replace function public.decision_log_guard()
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
  if v_status in ('ended', 'reported') then
    raise exception 'the decision log is locked once the exercise has ended'
      using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' and v_status <> 'live' then
    raise exception 'decisions can only be logged while the exercise is live'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  -- The server clock stamps every entry; a correction keeps the original time.
  new.logged_at := case when tg_op = 'INSERT' then now() else old.logged_at end;
  new.exercise_id := case when tg_op = 'INSERT' then new.exercise_id else old.exercise_id end;
  return new;
end;
$$;
revoke execute on function public.decision_log_guard() from public, anon, authenticated;

create trigger decision_log_guard
  before insert or update or delete on public.decision_log
  for each row execute function public.decision_log_guard();

alter table public.decision_log enable row level security;

grant select, insert, update, delete on public.decision_log to authenticated;
grant all on public.decision_log to service_role;

create policy "members read the log"
  on public.decision_log for select
  to authenticated
  using (public.is_exercise_member(exercise_id));

create policy "members add log entries"
  on public.decision_log for insert
  to authenticated
  with check (public.is_exercise_member(exercise_id) and (created_by is null or created_by = auth.uid()));

create policy "members correct log entries"
  on public.decision_log for update
  to authenticated
  using (public.is_exercise_member(exercise_id))
  with check (public.is_exercise_member(exercise_id));

create policy "members remove log entries"
  on public.decision_log for delete
  to authenticated
  using (public.is_exercise_member(exercise_id));

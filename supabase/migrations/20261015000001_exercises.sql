-- Phase 3: exercises (SPEC.md section 6). One tabletop exercise run against a scenario and,
-- when one exists, a plan version. Same pattern as Phase 2: explicit grants, RLS, member
-- policies through is_org_member(). Three columns the spec's model does not list are
-- needed by the console: revealed_count and reveal_times (which injects the facilitator
-- has shown, and when) and parking_lot (free notes taken during the session).

create table public.exercises (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  scenario_id     uuid not null references public.scenarios (id) on delete cascade,
  -- Set null rather than restrict, so deleting a draft plan can never orphan evidence.
  ir_plan_id      uuid references public.ir_plans (id) on delete set null,
  title           text not null check (char_length(title) between 1 and 200),
  scheduled_at    timestamptz,
  started_at      timestamptz,
  ended_at        timestamptz,
  status          text not null default 'scheduled'
                  check (status in ('scheduled', 'live', 'ended', 'reported')),
  facilitator_id  uuid references auth.users (id) on delete set null,
  revealed_count  integer not null default 0 check (revealed_count between 0 and 20),
  reveal_times    timestamptz[] not null default '{}',
  parking_lot     text not null default '' check (char_length(parking_lot) <= 5000),
  created_at      timestamptz not null default now(),
  -- Timestamps travel with the status.
  check ((status in ('ended', 'reported')) = (ended_at is not null)),
  check (status = 'scheduled' or started_at is not null)
);
create index exercises_org_id_idx on public.exercises (org_id, created_at desc);
create index exercises_scenario_id_idx on public.exercises (scenario_id);
create index exercises_ir_plan_id_idx on public.exercises (ir_plan_id) where ir_plan_id is not null;

-- Membership through an exercise, for the tables that hang off it. SECURITY DEFINER for
-- the same reason as is_org_member(): one place, no policy recursion.
create or replace function public.is_exercise_member(p_exercise_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.exercises e
    join public.org_members m on m.org_id = e.org_id
    where e.id = p_exercise_id and m.user_id = auth.uid()
  );
$$;
revoke execute on function public.is_exercise_member(uuid) from public, anon;
grant  execute on function public.is_exercise_member(uuid) to authenticated, service_role;

-- Status only moves forward (scheduled -> live -> ended -> reported) and the end time,
-- once set, never changes: the after-action report depends on both.
create or replace function public.exercises_guard_status()
returns trigger
language plpgsql
as $$
declare
  v_old integer := array_position(array['scheduled', 'live', 'ended', 'reported'], old.status);
  v_new integer := array_position(array['scheduled', 'live', 'ended', 'reported'], new.status);
begin
  if v_new < v_old then
    raise exception 'an exercise cannot go back from % to %', old.status, new.status
      using errcode = 'check_violation';
  end if;
  if old.ended_at is not null and new.ended_at is distinct from old.ended_at then
    raise exception 'the end time of an exercise cannot be changed' using errcode = 'check_violation';
  end if;
  if old.started_at is not null and new.started_at is distinct from old.started_at then
    raise exception 'the start time of an exercise cannot be changed' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function public.exercises_guard_status() from public, anon, authenticated;

create trigger exercises_guard_status
  before update on public.exercises
  for each row execute function public.exercises_guard_status();

alter table public.exercises enable row level security;

grant select, insert, update, delete on public.exercises to authenticated;
grant all on public.exercises to service_role;

create policy "members read their exercises"
  on public.exercises for select
  to authenticated
  using (public.is_org_member(org_id));

create policy "members add exercises"
  on public.exercises for insert
  to authenticated
  with check (public.is_org_member(org_id) and (facilitator_id is null or facilitator_id = auth.uid()));

create policy "members update their exercises"
  on public.exercises for update
  to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

-- Scheduled exercises can be discarded; anything that ran is evidence and stays.
create policy "members delete scheduled exercises"
  on public.exercises for delete
  to authenticated
  using (public.is_org_member(org_id) and status = 'scheduled');

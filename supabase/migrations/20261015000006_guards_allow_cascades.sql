-- Fix: the decision_log and findings guards blocked two things that are not edits.
--   1. Deleting an account sets created_by to null through the foreign key, which is an
--      UPDATE the guard refused on an ended exercise (same class of bug as 20261014000005).
--   2. Deleting an organization or exercise cascades into the log, and the guard refused
--      those DELETEs too. In a cascade the parent exercise row is already gone when the
--      child trigger fires, so a missing parent means "cascade in progress".
-- Content changes after the end are still refused.

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

  if tg_op = 'DELETE' then
    if v_status is null then
      return old; -- the exercise is being deleted; the cascade may proceed
    end if;
    if v_status in ('ended', 'reported') then
      raise exception 'the decision log is locked once the exercise has ended'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    -- Bookkeeping only (created_by nulled when an account is deleted): always allowed.
    if row(new.exercise_id, new.inject_index, new.logged_at, new.actor_name, new.decision, new.notes)
       is not distinct from
       row(old.exercise_id, old.inject_index, old.logged_at, old.actor_name, old.decision, old.notes) then
      return new;
    end if;
    if v_status is null or v_status in ('ended', 'reported') then
      raise exception 'the decision log is locked once the exercise has ended'
        using errcode = 'check_violation';
    end if;
    new.exercise_id := old.exercise_id;
    new.logged_at := old.logged_at; -- a correction keeps the original time
    return new;
  end if;

  -- INSERT: only while live, and the server clock stamps the entry.
  if v_status is null then
    raise exception 'unknown exercise' using errcode = 'foreign_key_violation';
  end if;
  if v_status <> 'live' then
    raise exception 'decisions can only be logged while the exercise is live'
      using errcode = 'check_violation';
  end if;
  new.logged_at := now();
  return new;
end;
$$;

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

  if tg_op = 'DELETE' then
    if v_status is null then
      return old; -- cascade in progress
    end if;
    if v_status = 'reported' then
      raise exception 'findings are frozen once the report is finalized'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if row(new.exercise_id, new.kind, new.description, new.severity, new.owner_name, new.due_date)
       is not distinct from
       row(old.exercise_id, old.kind, old.description, old.severity, old.owner_name, old.due_date) then
      return new; -- bookkeeping only
    end if;
    if v_status is null or v_status = 'reported' then
      raise exception 'findings are frozen once the report is finalized'
        using errcode = 'check_violation';
    end if;
    new.exercise_id := old.exercise_id;
    return new;
  end if;

  if v_status is null then
    raise exception 'unknown exercise' using errcode = 'foreign_key_violation';
  end if;
  if v_status = 'scheduled' then
    raise exception 'findings can be added once the exercise has started'
      using errcode = 'check_violation';
  end if;
  if v_status = 'reported' then
    raise exception 'findings are frozen once the report is finalized'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

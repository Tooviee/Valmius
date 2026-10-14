-- Fix: the approved-plan guard compared every column, so the `on delete set null` action
-- on ir_plans.created_by (when the author's account is deleted) counted as an edit and
-- blocked the deletion. created_by is bookkeeping, not plan content; leave it out.

create or replace function public.ir_plans_guard_approved()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'approved' and (
    new.org_id           is distinct from old.org_id or
    new.questionnaire_id is distinct from old.questionnaire_id or
    new.version          is distinct from old.version or
    new.sections         is distinct from old.sections or
    new.status           is distinct from old.status or
    new.approved_by_name is distinct from old.approved_by_name or
    new.approved_at      is distinct from old.approved_at or
    new.created_at       is distinct from old.created_at
  ) then
    raise exception 'an approved plan version cannot be changed; save a new version instead'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function public.ir_plans_guard_approved() from public, anon, authenticated;

-- Event counts per UTC day and event name, for the Phase 1 /admin/leads page.
-- Aggregating in SQL avoids pulling raw event rows through the Data API's row limit.
create or replace function public.event_counts_by_day(p_since timestamptz)
returns table (day date, name text, count bigint)
language sql
stable
as $$
  select (created_at at time zone 'utc')::date as day, name, count(*) as count
  from public.events
  where created_at >= p_since
  group by 1, 2
  order by 1 desc, 2;
$$;

-- Same pattern as the Phase 1 schema: functions are executable by PUBLIC by default,
-- so lock this one to the server (SPEC.md section 5).
revoke execute on function public.event_counts_by_day(timestamptz) from public, anon, authenticated;
grant  execute on function public.event_counts_by_day(timestamptz) to service_role;

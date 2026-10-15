-- Phase 3: exercise_participants (SPEC.md section 6). People in the room. They have no
-- account: their link carries a 32-byte token, checked server-side with the service role
-- (SPEC.md section 11). The browser never reads this table as a participant.

create table public.exercise_participants (
  id              uuid primary key default gen_random_uuid(),
  exercise_id     uuid not null references public.exercises (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 120),
  email           text check (char_length(email) <= 254),
  role            text not null check (char_length(role) between 1 and 120),
  -- 32 random bytes, base64url without padding, always 43 characters.
  token           text not null unique check (char_length(token) = 43),
  attended_at     timestamptz,
  signed_off_at   timestamptz,
  signature_name  text check (char_length(signature_name) between 1 and 120),
  created_at      timestamptz not null default now(),
  check ((signed_off_at is null) = (signature_name is null))
);
create index exercise_participants_exercise_id_idx on public.exercise_participants (exercise_id);

alter table public.exercise_participants enable row level security;

grant select, insert, update, delete on public.exercise_participants to authenticated;
grant all on public.exercise_participants to service_role;

-- Facilitators (org members) manage the roster and see the tokens to build the links.
create policy "members read participants"
  on public.exercise_participants for select
  to authenticated
  using (public.is_exercise_member(exercise_id));

create policy "members add participants"
  on public.exercise_participants for insert
  to authenticated
  with check (public.is_exercise_member(exercise_id));

create policy "members update participants"
  on public.exercise_participants for update
  to authenticated
  using (public.is_exercise_member(exercise_id))
  with check (public.is_exercise_member(exercise_id));

create policy "members remove participants"
  on public.exercise_participants for delete
  to authenticated
  using (public.is_exercise_member(exercise_id));

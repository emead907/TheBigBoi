-- Gym Stars Hub · class registrations (from GoMotion's New Registrations report)
-- A registration is active when it isn't waitlisted, has started, and hasn't been dropped.

create table if not exists public.registrations (
  id             uuid primary key default gen_random_uuid(),
  gym_id         uuid not null references public.gyms(id) on delete cascade,
  member_id      uuid references public.members(id) on delete set null,
  match_key      text not null,              -- member name + birthday + class + slot + registration date
  member_name    text not null,
  birthday       date,
  account_name   text,
  phone          text,
  class_name     text not null,
  slot           text,
  payment_plan   text,
  registered_on  date,
  start_date     date,
  drop_date      date,
  waitlisted     boolean not null default false,
  imported_at    timestamptz not null default now(),
  unique (gym_id, match_key)
);
create index if not exists registrations_member_idx on public.registrations (member_id);
create index if not exists registrations_gym_class_idx on public.registrations (gym_id, class_name);

alter table public.registrations enable row level security;
drop policy if exists registrations_read on public.registrations;
drop policy if exists registrations_write on public.registrations;
drop policy if exists registrations_update on public.registrations;
drop policy if exists registrations_delete on public.registrations;
create policy registrations_read   on public.registrations for select using (is_member(gym_id));
create policy registrations_write  on public.registrations for insert with check (is_owner(gym_id));
create policy registrations_update on public.registrations for update using (is_owner(gym_id)) with check (is_owner(gym_id));
create policy registrations_delete on public.registrations for delete using (is_owner(gym_id));

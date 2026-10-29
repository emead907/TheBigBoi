-- Gym Stars Hub · initial schema
-- Every row belongs to a gym, so more gyms (or other businesses) can be added later.

create extension if not exists pgcrypto;

-- ───────────────────────── Gyms & staff ─────────────────────────
create table public.gyms (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name         text not null,
  short_name   text not null,
  phone        text,
  email        text,              -- where parent replies go
  from_email   text,              -- sending address, on a domain verified in Resend
  sms_from     text,              -- Twilio number, +1XXXXXXXXXX
  address      text,
  website      text,
  timezone     text not null default 'America/Boise',
  brand_color  text not null default '#004380',
  intake_key   text not null default encode(gen_random_bytes(18), 'hex'),
  created_at   timestamptz not null default now()
);

create table public.memberships (
  gym_id       uuid not null references public.gyms(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'staff' check (role in ('owner', 'staff')),
  display_name text,
  created_at   timestamptz not null default now(),
  primary key (gym_id, user_id)
);
create index memberships_user_idx on public.memberships(user_id);

-- ───────────────────────── Trials ─────────────────────────
-- One row per child. Stage is derived from first_day + status (see src/lib/stages.ts):
--   no first day → New · future → Upcoming · today → Today · past → Follow-Up
--   status enrolled → Enrolled · not_enrolling / no_show → Closed
create table public.trials (
  id                 uuid primary key default gen_random_uuid(),
  gym_id             uuid not null references public.gyms(id) on delete cascade,
  source             text not null default 'manual' check (source in ('website', 'email', 'manual', 'phone', 'walk_in')),
  received_at        timestamptz not null default now(),

  child_name         text not null,
  birthday           date,
  class_name         text,
  requested_time     text,

  parent_name        text,
  parent_email       text,
  parent_phone       text,
  zip                text,
  sms_opt_in         boolean not null default false,

  in_sportsengine    boolean not null default false,
  spot_email_sent_at timestamptz,
  called_at          timestamptz,
  first_day          date,
  first_day_time     text,
  showed_up          boolean,
  status             text not null default 'open' check (status in ('open', 'enrolled', 'not_enrolling', 'no_show')),
  followed_up_at     timestamptz,
  closed_at          timestamptz,
  notes              text,

  reminder_sent_at   timestamptz,
  followup_sent_at   timestamptz,
  external_id        text,          -- e.g. Gmail message id, to avoid duplicates

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users(id)
);
create index trials_gym_idx on public.trials(gym_id, status, first_day);
-- Postgres treats NULLs as distinct, so many rows without an external_id are fine.
alter table public.trials add constraint trials_external_unique unique (gym_id, external_id);

create table public.activity (
  id         bigint generated always as identity primary key,
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  trial_id   uuid not null references public.trials(id) on delete cascade,
  user_id    uuid references auth.users(id),
  actor      text,                       -- display name, or 'Website' / 'Auto'
  kind       text not null,
  detail     text,
  created_at timestamptz not null default now()
);
create index activity_trial_idx on public.activity(trial_id, created_at desc);

-- ───────────────────────── Messages ─────────────────────────
create table public.templates (
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  key        text not null check (key in ('spot_ready', 'first_day_reminder', 'follow_up')),
  channel    text not null check (channel in ('email', 'sms')),
  subject    text,
  body       text not null,
  auto_send  boolean not null default false,   -- reminder / follow-up go out automatically when true
  updated_at timestamptz not null default now(),
  primary key (gym_id, key, channel)
);

create table public.messages (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid not null references public.gyms(id) on delete cascade,
  trial_id     uuid not null references public.trials(id) on delete cascade,
  channel      text not null check (channel in ('email', 'sms')),
  template_key text,
  to_address   text not null,
  subject      text,
  body         text not null,
  status       text not null default 'sent' check (status in ('sent', 'failed', 'not_configured')),
  provider_id  text,
  error        text,
  sent_by      uuid references auth.users(id),
  created_at   timestamptz not null default now()
);
create index messages_trial_idx on public.messages(trial_id, created_at desc);

-- ───────────────────────── Helpers ─────────────────────────
create or replace function public.is_member(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where gym_id = g and user_id = auth.uid());
$$;

create or replace function public.is_owner(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where gym_id = g and user_id = auth.uid() and role = 'owner');
$$;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger trials_touch before update on public.trials
  for each row execute function public.touch_updated_at();

-- ───────────────────────── Row-level security ─────────────────────────
alter table public.gyms        enable row level security;
alter table public.memberships enable row level security;
alter table public.trials      enable row level security;
alter table public.activity    enable row level security;
alter table public.templates   enable row level security;
alter table public.messages    enable row level security;

create policy gyms_read   on public.gyms for select using (is_member(id));
create policy gyms_update on public.gyms for update using (is_owner(id)) with check (is_owner(id));

create policy members_read on public.memberships for select using (is_member(gym_id));
create policy members_self_update on public.memberships for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy trials_all on public.trials for all using (is_member(gym_id)) with check (is_member(gym_id));
create policy activity_read on public.activity for select using (is_member(gym_id));
create policy activity_insert on public.activity for insert with check (is_member(gym_id));
create policy templates_read on public.templates for select using (is_member(gym_id));
create policy templates_write on public.templates for all using (is_owner(gym_id)) with check (is_owner(gym_id));
create policy messages_read on public.messages for select using (is_member(gym_id));
create policy messages_insert on public.messages for insert with check (is_member(gym_id));

-- Gym Stars Hub · birthday parties
create table if not exists public.parties (
  id               uuid primary key default gen_random_uuid(),
  gym_id           uuid not null references public.gyms(id) on delete cascade,
  source           text not null default 'manual',     -- website, manual, phone, email
  received_at      timestamptz not null default now(),
  status           text not null default 'inquiry' check (status in ('inquiry', 'booked', 'completed', 'cancelled', 'not_booked')),

  parent_name      text,
  parent_email     text,
  parent_phone     text,
  child_name       text,
  child_age        text,                                -- age they're turning
  party_date       date,
  time_slot        text,                                -- e.g. "1:00 – 2:30 PM"
  num_children     integer,
  children_ages    text,
  theme            text,
  add_ons          text[] not null default '{}',
  package          text not null default 'party_room',  -- party_room | gym_only
  comments         text,                                -- what the family wrote

  total_price      numeric(8,2),
  amount_paid      numeric(8,2) not null default 0,
  paid_at          timestamptz,
  contacted_at     timestamptz,
  confirmed_at     timestamptz,                         -- confirmation sent to the family
  coach            text,
  notes            text,
  external_id      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint parties_external_unique unique (gym_id, external_id)
);
create index if not exists parties_gym_date_idx on public.parties (gym_id, party_date);
drop trigger if exists parties_touch on public.parties;
create trigger parties_touch before update on public.parties for each row execute function public.touch_updated_at();

alter table public.parties enable row level security;
drop policy if exists parties_all on public.parties;
drop policy if exists parties_delete on public.parties;
drop policy if exists parties_insert on public.parties;
drop policy if exists parties_update on public.parties;
create policy parties_all    on public.parties for select using (is_member(gym_id));
create policy parties_insert on public.parties for insert with check (is_member(gym_id));
create policy parties_update on public.parties for update using (is_member(gym_id)) with check (is_member(gym_id));
create policy parties_delete on public.parties for delete using (is_owner(gym_id));

-- Activity log works for parties too.
alter table public.activity alter column trial_id drop not null;
alter table public.activity add column if not exists party_id uuid references public.parties(id) on delete cascade;
create index if not exists activity_party_idx on public.activity (party_id, created_at desc);

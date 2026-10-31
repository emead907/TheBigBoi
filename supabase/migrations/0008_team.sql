-- Gym Stars Hub · competition team: athletes, meets, sign-ups, practice groups, comp fees and budget
create table if not exists public.team_athletes (
  id                     uuid primary key default gen_random_uuid(),
  gym_id                 uuid not null references public.gyms(id) on delete cascade,
  name                   text not null,
  level                  text,          -- Level 1-3, Bronze, Silver, Gold, Platinum, Diamond
  group_name             text,          -- Group A-F, Level 1
  hours                  numeric,
  is_new                 boolean not null default false,
  contract_signed        boolean not null default false,
  usag_member            boolean not null default false,
  backpack_needed        boolean not null default false,
  backpack_given         boolean not null default false,
  comp_leo_size          text,
  practice_leo_size      text,
  practice_leo_received  boolean not null default false,
  warmup_size            text,
  mom_email              text,
  dad_email              text,
  notes                  text,
  active                 boolean not null default true,
  created_at             timestamptz not null default now()
);
create index if not exists team_athletes_gym_idx on public.team_athletes (gym_id, active);

create table if not exists public.team_meets (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  name        text not null,
  start_date  date,
  end_date    date,
  location    text,
  required    boolean not null default false,
  levels      text[] not null default '{}',     -- which levels compete at this meet
  fees        jsonb not null default '{}',      -- entry fee per athlete by level, e.g. {"Gold": 145}
  team_fee    numeric not null default 0,       -- per level entered
  notes       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.team_entries (
  meet_id     uuid not null references public.team_meets(id) on delete cascade,
  athlete_id  uuid not null references public.team_athletes(id) on delete cascade,
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (meet_id, athlete_id)
);

create table if not exists public.team_groups (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  name        text not null,
  label       text,
  practices   jsonb not null default '[]',      -- [{"day":"Monday","time":"4:30-8:30","coach":"Emily"}]
  sort        int not null default 0,
  unique (gym_id, name)
);

-- Money: managers only
create table if not exists public.team_fees (
  athlete_id  uuid primary key references public.team_athletes(id) on delete cascade,
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  total       numeric,
  plan        text,                             -- '4 payments' | 'Pay in full'
  paid_1      boolean not null default false,   -- Aug 15 (or paid in full)
  paid_2      boolean not null default false,   -- Sep 15
  paid_3      boolean not null default false,   -- Oct 15
  paid_4      boolean not null default false,   -- Nov 15
  notes       text
);

create table if not exists public.team_expenses (
  id      uuid primary key default gen_random_uuid(),
  gym_id  uuid not null references public.gyms(id) on delete cascade,
  label   text not null,
  amount  numeric not null default 0,
  sort    int not null default 0
);

alter table public.team_athletes enable row level security;
alter table public.team_meets    enable row level security;
alter table public.team_entries  enable row level security;
alter table public.team_groups   enable row level security;
alter table public.team_fees     enable row level security;
alter table public.team_expenses enable row level security;

create policy team_athletes_rw on public.team_athletes for all using (is_member(gym_id)) with check (is_member(gym_id));
create policy team_entries_rw  on public.team_entries  for all using (is_member(gym_id)) with check (is_member(gym_id));
create policy team_meets_read  on public.team_meets  for select using (is_member(gym_id));
create policy team_meets_write on public.team_meets  for all using (is_owner(gym_id)) with check (is_owner(gym_id));
create policy team_groups_read  on public.team_groups for select using (is_member(gym_id));
create policy team_groups_write on public.team_groups for all using (is_owner(gym_id)) with check (is_owner(gym_id));
create policy team_fees_owner     on public.team_fees     for all using (is_owner(gym_id)) with check (is_owner(gym_id));
create policy team_expenses_owner on public.team_expenses for all using (is_owner(gym_id)) with check (is_owner(gym_id));


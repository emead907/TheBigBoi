-- Per-gym colors: header/buttons use brand_color, highlights use accent_color.
alter table public.gyms add column if not exists accent_color text not null default '#7fc0d4';
update public.gyms set brand_color = '#3b2a7e', accent_color = '#ff4fa3' where slug = 'gym-nest';
update public.gyms set brand_color = '#004380', accent_color = '#7fc0d4' where slug = 'gym-stars';

-- Gym Stars Hub · People (families and athletes)
-- accounts = parents / adults who hold the account; members = athletes on that account.
-- match_key lets a re-import update the same person instead of adding a duplicate.

create table if not exists public.accounts (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  match_key   text not null,                 -- lower(email), or name + phone when there is no email
  first_name  text,
  last_name   text,
  email       text,
  mobile      text,
  phone       text,
  sms_status  text,                          -- from GoMotion: Verified, Unverified, Sent, Stopped
  status      text not null default 'active',
  notes       text,
  source      text not null default 'import',
  imported_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (gym_id, match_key)
);
create index if not exists accounts_gym_name_idx on public.accounts (gym_id, last_name, first_name);
create index if not exists accounts_gym_email_idx on public.accounts (gym_id, lower(email));

create table if not exists public.members (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  account_id  uuid not null references public.accounts(id) on delete cascade,
  match_key   text not null,                 -- account key + name + birthday
  first_name  text not null,
  last_name   text,
  birthday    date,
  gender      text,
  classes     text[] not null default '{}',  -- e.g. 'Shining Stars | Reg Slot #8'
  bookings    text[] not null default '{}',  -- upcoming events from GoMotion
  status      text not null default 'active',
  notes       text,
  imported_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (gym_id, match_key)
);
create index if not exists members_account_idx on public.members (account_id);
create index if not exists members_gym_name_idx on public.members (gym_id, last_name, first_name);

drop trigger if exists accounts_touch on public.accounts;
create trigger accounts_touch before update on public.accounts for each row execute function public.touch_updated_at();
drop trigger if exists members_touch on public.members;
create trigger members_touch before update on public.members for each row execute function public.touch_updated_at();

alter table public.accounts enable row level security;
alter table public.members  enable row level security;

drop policy if exists accounts_read on public.accounts;
drop policy if exists accounts_write on public.accounts;
drop policy if exists accounts_delete on public.accounts;
drop policy if exists accounts_update on public.accounts;
create policy accounts_read   on public.accounts for select using (is_member(gym_id));
create policy accounts_write  on public.accounts for insert with check (is_member(gym_id));
create policy accounts_update on public.accounts for update using (is_member(gym_id)) with check (is_member(gym_id));
create policy accounts_delete on public.accounts for delete using (is_owner(gym_id));

drop policy if exists members_read on public.members;
drop policy if exists members_write on public.members;
drop policy if exists members_delete on public.members;
drop policy if exists members_update on public.members;
create policy members_read   on public.members for select using (is_member(gym_id));
create policy members_write  on public.members for insert with check (is_member(gym_id));
create policy members_update on public.members for update using (is_member(gym_id)) with check (is_member(gym_id));
create policy members_delete on public.members for delete using (is_owner(gym_id));

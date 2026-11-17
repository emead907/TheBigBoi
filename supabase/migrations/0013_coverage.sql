-- Gym Stars Hub · temporary coverage tracker (Thanksgiving week 2026)
-- Who coaches each class / camp slot, whether they're in town, and who covers if not.
create table if not exists public.coverage_slots (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  day         date not null,
  kind        text not null default 'class',   -- camp, opengym, class, team
  name        text not null,
  time_label  text,
  start_min   int,                              -- minutes after midnight, for sorting
  room        text,
  coach       text,
  status      text,                             -- 'in', 'out' or null
  cover       text,
  updated_by  text,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index if not exists coverage_slots_gym_day_idx on public.coverage_slots (gym_id, day);

alter table public.coverage_slots enable row level security;
drop policy if exists coverage_slots_rw on public.coverage_slots;
create policy coverage_slots_rw on public.coverage_slots for all using (is_member(gym_id)) with check (is_member(gym_id));

-- Thanksgiving week classes, camp and open gym for Gym Stars (only if not already loaded)
insert into public.coverage_slots (gym_id, day, kind, name, time_label, start_min, room)
select g.id, v.day::date, v.kind, v.name, v.time_label, v.start_min, v.room
from public.gyms g
cross join (values
  ('2026-11-23', 'camp', 'Camp – Coach 1', '8:00-12:00', 480, null),
  ('2026-11-23', 'camp', 'Camp – Coach 2', '8:00-12:00', 480, null),
  ('2026-11-23', 'camp', 'Camp – Coach 1', '12:00-4:00', 720, null),
  ('2026-11-23', 'camp', 'Camp – Coach 2', '12:00-4:00', 720, null),
  ('2026-11-23', 'opengym', 'Drop-in open gym', '11:00-4:00', 660, null),
  ('2026-11-23', 'class', 'Shooting Stars', '4:30-5:30', 990, 'Little gym'),
  ('2026-11-23', 'class', 'Shining Stars', '4:30-5:30', 990, 'Little gym'),
  ('2026-11-23', 'class', 'Adv Tumbling', '4:30-5:30', 990, 'Little gym'),
  ('2026-11-23', 'class', 'STARZ! 1', '4:30-5:30', 990, 'Big gym'),
  ('2026-11-23', 'team', 'Team', '4:30-8:30', 990, 'Big gym'),
  ('2026-11-23', 'class', 'Shooting Stars', '5:30-6:30', 1050, 'Little gym'),
  ('2026-11-23', 'class', 'Shining Stars', '5:30-6:30', 1050, 'Little gym'),
  ('2026-11-23', 'class', 'Ninja 2', '5:30-6:30', 1050, 'Little gym'),
  ('2026-11-23', 'class', 'STARZ! 2', '5:30-6:30', 1050, 'Big gym'),
  ('2026-11-23', 'class', 'STARZ! 3', '6:30-7:30', 1110, 'Big gym'),
  ('2026-11-23', 'class', 'Intermediate', '6:30-7:30', 1110, 'Big gym'),
  ('2026-11-24', 'camp', 'Camp – Coach 1', '8:00-12:00', 480, null),
  ('2026-11-24', 'camp', 'Camp – Coach 2', '8:00-12:00', 480, null),
  ('2026-11-24', 'camp', 'Camp – Coach 1', '12:00-4:00', 720, null),
  ('2026-11-24', 'camp', 'Camp – Coach 2', '12:00-4:00', 720, null),
  ('2026-11-24', 'opengym', 'Drop-in open gym', '1:00-4:00', 780, null),
  ('2026-11-24', 'class', 'Tiny Stars', '10:30-11:15', 630, null),
  ('2026-11-24', 'class', 'Twinkling Stars', '10:30-11:15', 630, null),
  ('2026-11-24', 'class', 'Preschool Gym', '11:15-12:00', 675, null),
  ('2026-11-24', 'class', 'Homeschool', '12:00-1:00', 720, null),
  ('2026-11-24', 'class', 'Shooting Stars', '1:00-2:00', 780, null),
  ('2026-11-24', 'class', 'Ninja 1', '4:30-5:30', 990, 'Little gym'),
  ('2026-11-24', 'class', 'Twinkling Stars', '4:45-5:30', 1005, 'Little gym'),
  ('2026-11-24', 'class', 'Shining Stars', '4:30-5:30', 990, 'Big gym'),
  ('2026-11-24', 'team', 'Team', '4:30-7:30', 990, 'Big gym'),
  ('2026-11-24', 'team', 'Pre-team', '5:00-7:00', 1020, 'Big gym'),
  ('2026-11-24', 'class', 'Ninja 2', '5:30-6:30', 1050, 'Little gym'),
  ('2026-11-24', 'class', 'Shooting Stars', '5:30-6:30', 1050, 'Little gym'),
  ('2026-11-24', 'class', 'Shining Stars', '5:30-6:30', 1050, 'Big gym'),
  ('2026-11-24', 'class', 'Shooting Stars', '6:30-7:30', 1110, 'Little gym'),
  ('2026-11-24', 'class', 'Ninja 3', '6:30-7:30', 1110, 'Big gym'),
  ('2026-11-24', 'class', 'Shining Stars', '6:30-7:30', 1110, 'Big gym'),
  ('2026-11-25', 'camp', 'Camp – Coach 1', '8:00-12:00', 480, null),
  ('2026-11-25', 'camp', 'Camp – Coach 2', '8:00-12:00', 480, null),
  ('2026-11-25', 'camp', 'Camp – Coach 1', '12:00-4:00', 720, null),
  ('2026-11-25', 'camp', 'Camp – Coach 2', '12:00-4:00', 720, null),
  ('2026-11-25', 'opengym', 'Drop-in open gym', '11:00-4:00', 660, null)
) as v(day, kind, name, time_label, start_min, room)
where g.slug = 'gym-stars'
  and not exists (select 1 from public.coverage_slots c where c.gym_id = g.id and c.day between '2026-11-23' and '2026-11-25');

-- Gym Stars Hub · which plan a family enrolled on
alter table public.trials add column if not exists enroll_plan text
  check (enroll_plan in ('six_month', 'month_to_month'));

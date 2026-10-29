-- Gym Stars Hub · waitlist
-- A trial is on the waitlist while waitlisted_at is set, offered_at is empty and status is open.
-- "Offer spot" sets offered_at, which moves the family into New Requests.

alter table public.trials
  add column if not exists waitlisted_at timestamptz,
  add column if not exists offered_at    timestamptz;

create index if not exists trials_waitlist_idx
  on public.trials (gym_id, class_name, waitlisted_at)
  where waitlisted_at is not null and offered_at is null and status = 'open';

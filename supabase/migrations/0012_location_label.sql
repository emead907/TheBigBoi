-- Gym Stars Hub · location label so Nampa and Eagle are easy to tell apart
alter table public.gyms add column if not exists location_label text;
update public.gyms set location_label = 'Nampa' where slug = 'gym-nest';
update public.gyms set location_label = 'Eagle' where slug = 'gym-nest-eagle';

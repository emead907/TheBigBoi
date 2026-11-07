-- Gym Stars Hub · Jackrabbit class feed (The Gym Nest only)
alter table public.gyms add column if not exists jackrabbit_org_id text;
update public.gyms set jackrabbit_org_id = '537979' where slug = 'gym-nest';

-- One Jackrabbit account, two locations: each hub shows only its own location's classes.
alter table public.gyms add column if not exists jackrabbit_location text;

update public.gyms set name = 'The Gym Nest – Nampa', jackrabbit_location = 'Nampa' where slug = 'gym-nest';

-- A separate hub for Eagle, starting from the Nampa hub's settings (update phone/address in Settings).
insert into public.gyms (slug, name, short_name, phone, email, from_email, sms_from, address, website, timezone,
                         brand_color, accent_color, waiver_url, jackrabbit_org_id, jackrabbit_location)
select 'gym-nest-eagle', 'The Gym Nest – Eagle', short_name, phone, email, from_email, sms_from, null, website, timezone,
       brand_color, accent_color, waiver_url, jackrabbit_org_id, 'Eagle'
from public.gyms where slug = 'gym-nest'
on conflict (slug) do nothing;

-- Same managers and staff as Nampa to start; remove anyone who shouldn't see Eagle in Settings.
insert into public.memberships (gym_id, user_id, role, display_name)
select e.id, m.user_id, m.role, m.display_name
from public.memberships m
join public.gyms n on n.id = m.gym_id and n.slug = 'gym-nest'
cross join public.gyms e where e.slug = 'gym-nest-eagle'
on conflict do nothing;

-- Same email and text templates as Nampa.
insert into public.templates (gym_id, key, channel, subject, body, auto_send)
select e.id, t.key, t.channel, t.subject, t.body, t.auto_send
from public.templates t
join public.gyms n on n.id = t.gym_id and n.slug = 'gym-nest'
cross join public.gyms e where e.slug = 'gym-nest-eagle'
on conflict (gym_id, key, channel) do nothing;

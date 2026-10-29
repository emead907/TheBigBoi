-- Gym Stars Hub · starting data
-- Run once in Supabase → SQL Editor after 0001_init.sql.
-- Then add yourself in Supabase → Authentication → Users → "Add user" (use your email),
-- and run the "make me owner" block at the bottom with that email.

insert into public.gyms (slug, name, short_name, phone, email, from_email, address, website, brand_color)
values
  ('gym-stars', 'Gym Stars Gymnastics', 'Gym Stars', '(208) 866-2699', 'gymstarsidahoinfo@gmail.com',
   'Gym Stars Gymnastics <hello@gymstarsidaho.com>', '11915 W. Executive Dr, Unit 101, Boise, ID', 'https://gymstarsidaho.com', '#004380'),
  ('gym-nest', 'The Gym Nest Activity Center', 'The Gym Nest', '208-278-2011', 'info@thegymneststudio.com',
   'The Gym Nest <hello@thegymneststudio.com>', null, 'https://thegymneststudio.com', '#4F6D8A')
on conflict (slug) do nothing;

-- Default message templates for every gym. Placeholders:
-- {{parent_first}} {{child_first}} {{class}} {{requested_time}} {{first_day}} {{first_day_time}} {{gym_name}} {{gym_phone}}
insert into public.templates (gym_id, key, channel, subject, body, auto_send)
select g.id, t.key, t.channel, t.subject, t.body, t.auto_send
from public.gyms g
cross join (values
  ('spot_ready', 'email', '{{child_first}}''s spot in {{class}} is ready!',
$$Hi {{parent_first}},

Great news! We have a spot for {{child_first}} in {{class}} ({{requested_time}}), and we can't wait to meet them!

Give us a call at {{gym_phone}} or reply to this email to pick {{child_first}}'s first day.

WHAT TO WEAR
A leotard, or shorts and a t-shirt, works great. Kids go barefoot on the floor, so no shoes or socks. Please have long hair pulled back and leave jewelry at home.

SIGN THE WAIVER
Before class, please sign the waiver in your parent portal. It only takes a minute, and it's required before kids can get on the floor.

NO-RISK FIRST DAY
Nothing is charged at class. Tuition and the $50 registration fee bill at the end of the next day. If it's not the right fit, just let us know within 24 hours of class and you won't be charged anything at all.

We can't wait to see {{child_first}} in the gym!$$, false),
  ('spot_ready', 'sms', null,
   'Hi {{parent_first}}! Great news from {{gym_name}}: we have a spot for {{child_first}} in {{class}}. Reply or call {{gym_phone}} to pick a first day! Reply STOP to opt out.', false),
  ('first_day_reminder', 'email', 'See you tomorrow, {{child_first}}!',
$$Hi {{parent_first}},

Just a reminder that {{child_first}}'s first day in {{class}} is tomorrow, {{first_day}}{{first_day_time}}. We're so excited!

A few quick reminders:
- Wear a leotard, or shorts and a t-shirt. Bare feet, hair pulled back, no jewelry.
- Please sign the waiver in your parent portal before class if you haven't yet.
- Arrive a few minutes early so we can help {{child_first}} find their class.

See you tomorrow!$$, true),
  ('first_day_reminder', 'sms', null,
   'Hi {{parent_first}}! Reminder: {{child_first}}''s first day at {{gym_name}} is tomorrow{{first_day_time}}. Wear a leo or shorts & tee, bare feet, hair back. See you there!', true),
  ('follow_up', 'email', 'How was {{child_first}}''s first day?',
$$Hi {{parent_first}},

Thank you for bringing {{child_first}} in for their first day! We loved having them in class.

If {{child_first}} is ready to keep going, you're all set. Tuition will bill through your parent portal. If you have any questions, or if it wasn't quite the right fit, just reply to this email or call us at {{gym_phone}}.

We hope to see {{child_first}} back in the gym soon!$$, false),
  ('follow_up', 'sms', null,
   'Hi {{parent_first}}, thanks for bringing {{child_first}} to {{gym_name}}! How did the first day go? Reply here or call {{gym_phone}} with any questions.', false)
) as t(key, channel, subject, body, auto_send)
on conflict (gym_id, key, channel) do nothing;

-- ── Make yourself the owner of both gyms ──
-- Replace the email below with the one you added in Authentication → Users.
-- insert into public.memberships (gym_id, user_id, role, display_name)
-- select g.id, u.id, 'owner', 'Emily'
-- from public.gyms g, auth.users u
-- where u.email = 'YOUR-EMAIL@example.com'
-- on conflict do nothing;

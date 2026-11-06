-- Gym Stars Hub · first-day confirmation message
alter table public.templates drop constraint if exists templates_key_check;
alter table public.templates add constraint templates_key_check check (key in (
  'spot_ready', 'first_day_confirm', 'first_day_reminder', 'follow_up', 'follow_up_2',
  'party_inquiry', 'party_confirmation', 'party_reminder', 'party_thank_you'));

alter table public.trials add column if not exists confirm_sent_at timestamptz;

insert into public.templates (gym_id, key, channel, subject, body, auto_send)
select g.id, t.key, t.channel, t.subject, t.body, false
from public.gyms g
cross join (values
  ('first_day_confirm', 'email', '{{child_first}}''s first day is set for {{first_day}}',
$$Hi {{parent_first}},

{{child_first}} is all set for their first day of {{class}} on {{first_day}}{{first_day_time}}. We're looking forward to meeting them!

A few things to know before you come:
- Please [sign the waiver in your parent portal]({{waiver_link}}) before class. We need it before {{child_first}} can get on the floor.
- A leotard, or shorts and a T-shirt, works great. Kids are barefoot, with long hair pulled back and jewelry left at home.
- Plan to arrive about 10 minutes early so we can get {{child_first}} checked in.

The first day is risk-free. If it isn't the right fit, just let us know within 24 hours and you won't be charged.

If anything changes, reply to this email or call us at {{gym_phone}}.

See you soon!$$),
  ('first_day_confirm', 'sms', null,
   'Hi {{parent_first}}! {{child_first}}''s first day of {{class}} at {{gym_name}} is set for {{first_day}}{{first_day_time}}. Please sign the waiver before class: {{waiver_link}}. See you then!')
) as t(key, channel, subject, body)
on conflict (gym_id, key, channel) do nothing;

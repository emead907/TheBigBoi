-- Gym Stars Hub · birthday party emails + a second class follow-up (No-Risk First Day)
alter table public.templates drop constraint if exists templates_key_check;
alter table public.templates add constraint templates_key_check check (key in (
  'spot_ready', 'first_day_reminder', 'follow_up', 'follow_up_2',
  'party_inquiry', 'party_confirmation', 'party_reminder', 'party_thank_you'));

alter table public.messages alter column trial_id drop not null;
alter table public.messages add column if not exists party_id uuid references public.parties(id) on delete cascade;
create index if not exists messages_party_idx on public.messages (party_id, created_at desc);

alter table public.trials  add column if not exists followup2_sent_at timestamptz;
alter table public.parties add column if not exists reminder_sent_at timestamptz;
alter table public.parties add column if not exists thanks_sent_at timestamptz;

insert into public.templates (gym_id, key, channel, subject, body, auto_send)
select g.id, t.key, t.channel, t.subject, t.body, t.auto_send
from public.gyms g
cross join (values
  -- ── Class follow-up #2: the No-Risk First Day policy ──
  ('follow_up_2', 'email', 'About {{child_first}}''s spot in {{class}}',
$$Hi {{parent_first}},

We hope {{child_first}} had a great first day! We wanted to make sure you have the details on how our No-Risk First Day works, since tuition is now billing on your account.

HOW IT WORKS
- Signing up for the first day saves {{child_first}}'s spot in class going forward.
- If it isn't a fit, letting us know within 24 hours of the first class means you won't be charged anything.
- If we don't hear from you, {{child_first}} stays enrolled, and monthly tuition plus the $50 registration fee bill to your account. Tuition then bills every 30 days.

WHAT TO DO NEXT
- Staying in class? Please log in to your parent portal and add a card on file so your account stays current: {{portal_link}}
- Not continuing? Please call us at {{gym_phone}} or reply to this email so we can update your account.

Thank you, and we hope to see {{child_first}} back in the gym soon!$$, false),
  ('follow_up_2', 'sms', null,
   'Hi {{parent_first}}, it''s {{gym_name}}. {{child_first}} is still enrolled in {{class}} and tuition is billing. Please add a card in your parent portal, or call {{gym_phone}} if you''re not continuing. Thank you!', false),

  -- ── Birthday parties (email only: party families haven't agreed to texts) ──
  ('party_inquiry', 'email', 'Your party request for {{party_date}}',
$$Hi {{parent_first}},

Thanks so much for reaching out about a party for {{child_first}}! We got your request for {{party_date}} at {{time_slot}}, and we'd love to have you.

Here's how our parties work: you get 90 minutes total, with an hour of gym time led by our coaches and then 30 minutes in the party room for cake and presents. It's $265 for up to 10 kids. If your group would rather stay on the gym floor the whole time, we can do 90 minutes of open gym instead.

To lock in your date, we just need the party paid in full. Give us a call at {{gym_phone}} or reply to this email and we'll get it taken care of. If plans change, everything but $50 is refundable as long as you let us know at least 24 hours ahead.

Any questions about timing, number of kids, add-ons, or anything else, just let us know. We're happy to help you plan it.

Talk soon!$$, false),

  ('party_confirmation', 'email', 'You''re booked! Party on {{party_date}}',
$$Hi {{parent_first}},

You're all set! Your party at {{gym_name}} is booked.

PARTY DETAILS
- Date: {{party_date}}
- Time: {{time_slot}}
- Kids: {{num_children}}
- Paid: {{amount_paid}}

BEFORE THE PARTY
- Every child who plays in the gym needs a signed waiver. Please share this link with your guests: {{waiver_link}}
- Kids should wear comfortable clothes they can move in. We go barefoot on the gym floor, and long hair should be pulled back.
- Please arrive about 10 minutes early so we can start on time.

If anything changes, reply to this email or call us at {{gym_phone}}. Cancellations made at least 24 hours before the party are refunded except for $50.

We can't wait to celebrate with you!$$, false),

  ('party_reminder', 'email', 'Your party at {{gym_name}} is coming up!',
$$Hi {{parent_first}},

The big day is almost here! Here's a quick checklist:

- Date and time: {{party_date}}, {{time_slot}}
- Waivers: every child who plays needs one. If you haven't yet, share this link with your guests: {{waiver_link}}
- Headcount: if your number of kids has changed, just reply and let us know.
- Arrive about 10 minutes early.

See you soon!$$, true),

  ('party_thank_you', 'email', 'Thank you for celebrating with us!',
$$Hi {{parent_first}},

Thank you for celebrating {{child_first}}'s birthday at {{gym_name}}! We had so much fun, and we hope everyone went home happy and tired.

If any of the kids loved being in the gym, we offer classes for all ages, and every new student starts with a No-Risk First Day. Reply to this email or call {{gym_phone}} and we'll help you find the right class.

Happy birthday to {{child_first}}!$$, false)
) as t(key, channel, subject, body, auto_send)
on conflict (gym_id, key, channel) do nothing;

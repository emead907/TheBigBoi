import { describe, expect, it } from 'vitest';
import { stageOf } from '@/lib/stages';
import { parseRequestEmail, toE164 } from '@/lib/parse';
import { addDays, ageOn, ymdInZone } from '@/lib/dates';
import { renderTemplate, templateVars } from '@/lib/templates';
import { funnel } from '@/lib/reports';
import type { Trial } from '@/lib/types';

describe('stageOf', () => {
  const today = '2026-10-28';
  it('places trials by first day and status', () => {
    expect(stageOf({ status: 'open', first_day: null }, today)).toBe('new');
    expect(stageOf({ status: 'open', first_day: '2026-11-02' }, today)).toBe('upcoming');
    expect(stageOf({ status: 'open', first_day: today }, today)).toBe('today');
    expect(stageOf({ status: 'open', first_day: '2026-10-27' }, today)).toBe('follow_up');
    expect(stageOf({ status: 'enrolled', first_day: '2026-10-27' }, today)).toBe('enrolled');
    expect(stageOf({ status: 'no_show', first_day: '2026-10-27' }, today)).toBe('closed');
  });
});

describe('parseRequestEmail', () => {
  const email = `Subject: Class request: Shining Stars (Girls Beginner) (Monday at 4:30–5:30 PM)

Confirm the spot and call to schedule.

Class: Shining Stars (Girls Beginner)
Requested time: Monday at 4:30–5:30 PM

Parent: Kaitlin Wills
Email: [kaitlinwills88@gmail.com](mailto:kaitlinwills88@gmail.com)
Phone: [9259220287](tel:(925)%20922-0287)
Zip: 83642

Child: Layla Wills
Birthday: 2018-08-15

Child: Mia Wills
Birthday: 3/4/2020`;
  it('reads every field and each child', () => {
    const p = parseRequestEmail(email);
    expect(p.class_name).toBe('Shining Stars (Girls Beginner)');
    expect(p.requested_time).toBe('Monday at 4:30–5:30 PM');
    expect(p.parent_name).toBe('Kaitlin Wills');
    expect(p.parent_email).toBe('kaitlinwills88@gmail.com');
    expect(p.parent_phone).toBe('(925) 922-0287');
    expect(p.zip).toBe('83642');
    expect(p.children).toEqual([
      { child_name: 'Layla Wills', birthday: '2018-08-15' },
      { child_name: 'Mia Wills', birthday: '2020-03-04' },
    ]);
  });
  it('makes texting numbers', () => {
    expect(toE164('(208) 866-2699')).toBe('+12088662699');
    expect(toE164('12')).toBeNull();
  });
});

describe('dates', () => {
  it('uses the gym time zone for "today"', () => {
    // 2026-10-29 03:00 UTC is still Oct 28 in Boise.
    expect(ymdInZone(new Date('2026-10-29T03:00:00Z'), 'America/Boise')).toBe('2026-10-28');
  });
  it('adds days across months', () => expect(addDays('2026-10-31', 1)).toBe('2026-11-01'));
  it('gives ages', () => {
    expect(ageOn('2018-08-15', '2026-10-28')).toBe('8 yrs');
    expect(ageOn('2025-02-24', '2026-10-28')).toBe('1 yr 8 mo');
  });
});

describe('templates', () => {
  it('fills placeholders', () => {
    const vars = templateVars({ parent_name: 'Kaitlin Wills', child_name: 'Layla Wills', class_name: 'Shining Stars', requested_time: null, first_day: '2026-11-02', first_day_time: '4:30 PM' } as Trial,
      { name: 'Gym Stars Gymnastics', short_name: 'Gym Stars', phone: '(208) 866-2699' });
    expect(renderTemplate('Hi {{parent_first}}! {{child_first}} starts {{first_day}}{{first_day_time}} at {{gym_name}}.', vars))
      .toBe('Hi Kaitlin! Layla starts Mon, Nov 2 at 4:30 PM at Gym Stars.');
  });
});

describe('reports', () => {
  it('computes the funnel', () => {
    const base = { received_at: '2026-10-01T00:00:00Z', class_name: 'A', spot_email_sent_at: null, closed_at: null };
    const f = funnel([
      { ...base, first_day: '2026-10-05', showed_up: true, status: 'enrolled' },
      { ...base, first_day: '2026-10-05', showed_up: false, status: 'no_show' },
      { ...base, first_day: null, showed_up: null, status: 'open' },
    ]);
    expect(f).toMatchObject({ requested: 3, scheduled: 2, showed: 1, enrolled: 1, decided: 2, rate: 0.5 });
  });
});

import { waitlistPositions } from '@/lib/stages';
describe('waitlist', () => {
  it('puts waitlisted trials in their own stage until a spot is offered', () => {
    expect(stageOf({ status: 'open', first_day: null, waitlisted_at: '2026-10-01T00:00:00Z', offered_at: null }, '2026-10-28')).toBe('waitlist');
    expect(stageOf({ status: 'open', first_day: null, waitlisted_at: '2026-10-01T00:00:00Z', offered_at: '2026-10-28T00:00:00Z' }, '2026-10-28')).toBe('new');
    expect(stageOf({ status: 'not_enrolling', first_day: null, waitlisted_at: '2026-10-01T00:00:00Z', offered_at: null }, '2026-10-28')).toBe('closed');
  });
  it('numbers families per class and time, oldest first', () => {
    const p = waitlistPositions([
      { id: 'a', class_name: 'Tiny Stars', requested_time: 'Wed 10:30', waitlisted_at: '2026-10-05' },
      { id: 'b', class_name: 'Tiny Stars', requested_time: 'Wed 10:30', waitlisted_at: '2026-10-01' },
      { id: 'c', class_name: 'Ninja', requested_time: 'Mon 4:30', waitlisted_at: '2026-10-09' },
    ]);
    expect(p).toEqual({ b: 1, a: 2, c: 1 });
  });
});

import { conflicts, dayName, partyStage } from '@/lib/parties';
describe('parties', () => {
  it('stages', () => {
    expect(partyStage({ status: 'inquiry', party_date: '2026-11-07' }, '2026-10-29')).toBe('inquiry');
    expect(partyStage({ status: 'booked', party_date: '2026-11-07' }, '2026-10-29')).toBe('upcoming');
    expect(partyStage({ status: 'booked', party_date: '2026-10-25' }, '2026-10-29')).toBe('past');
    expect(partyStage({ status: 'not_booked', party_date: null }, '2026-10-29')).toBe('closed');
  });
  it('weekend days and double bookings', () => {
    expect(dayName('2026-11-07')).toBe('Saturday');
    expect(dayName('2026-11-08')).toBe('Sunday');
    expect(dayName('2026-11-09')).toBeNull();
    const all = [{ id: 'a', party_date: '2026-11-07', time_slot: '1:00 – 2:30 PM', status: 'booked' as const }];
    expect(conflicts({ id: 'b', party_date: '2026-11-07', time_slot: '1:00 – 2:30 PM' }, all)).toHaveLength(1);
    expect(conflicts({ id: 'a', party_date: '2026-11-07', time_slot: '1:00 – 2:30 PM' }, all)).toHaveLength(0);
  });
});

import { parsePartyEmail } from '@/lib/parties';
it('reads a party request email', () => {
  const p = parsePartyEmail(`Party request: 2026-12-13 — Aubrea J Patterson
Check availability and call to confirm.

Requested by: Aubrea J Patterson
Email: pattersonaubrea@gmail.com
Phone: 2089220887

Date: 2026-12-13
Start time: 11:00 AM – 12:30 PM
Kids attending: 10
Ages: 7-10
Theme: Blue and red
Add-ons: Goodie Bags, Pizza

Comments:
Can we bring a cake?`);
  expect(p).toMatchObject({ parent_name: 'Aubrea J Patterson', parent_email: 'pattersonaubrea@gmail.com', parent_phone: '2089220887',
    party_date: '2026-12-13', time_slot: '11:00 AM – 12:30 PM', num_children: '10', children_ages: '7-10', theme: 'Blue and red',
    add_ons: ['Goodie Bags', 'Pizza'], comments: 'Can we bring a cake?' });
});

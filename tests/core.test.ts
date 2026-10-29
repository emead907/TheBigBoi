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

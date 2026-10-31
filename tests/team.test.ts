import { describe, expect, it } from 'vitest';
import { feePaid, meetCost, meetDates, missingRequired, sizeCounts, type TeamAthlete, type TeamFee, type TeamMeet } from '../src/lib/team';

const ath = (id: string, level: string) => ({ id, name: id, level } as TeamAthlete);
const meet = (id: string, extra: Partial<TeamMeet> = {}) => ({ id, name: id, levels: ['Bronze', 'Gold'], fees: { Bronze: 130, Gold: 145 }, team_fee: 50, required: true, start_date: '2026-12-11', end_date: '2026-12-13', ...extra } as TeamMeet);

describe('team helpers', () => {
  it('adds entry fees plus one team fee per level', () => {
    const a = [ath('a', 'Bronze'), ath('b', 'Bronze'), ath('c', 'Gold')];
    const c = meetCost(meet('m'), a, [{ meet_id: 'm', athlete_id: 'a' }, { meet_id: 'm', athlete_id: 'b' }, { meet_id: 'm', athlete_id: 'c' }]);
    expect(c.total).toBe(130 * 2 + 50 + 145 + 50);
    expect(c.count).toBe(3);
  });
  it('finds missing required meets for the athlete level only', () => {
    const meets = [meet('teddy'), meet('dev', { levels: ['Level 2'] }), meet('opt', { required: false })];
    expect(missingRequired(ath('a', 'Bronze'), meets, []).map((m) => m.id)).toEqual(['teddy']);
    expect(missingRequired(ath('a', 'Bronze'), meets, [{ meet_id: 'teddy', athlete_id: 'a' }])).toEqual([]);
  });
  it('works out what has been paid', () => {
    const f = { total: 1300, plan: '4 payments', paid_1: true, paid_2: true, paid_3: false, paid_4: false } as TeamFee;
    expect(feePaid(f)).toBe(650);
    expect(feePaid({ ...f, plan: 'Pay in full', paid_1: true })).toBe(1300);
  });
  it('formats dates and counts sizes', () => {
    expect(meetDates(meet('m'))).toBe('Dec 11–13, 2026');
    expect(meetDates(meet('m', { start_date: '2027-01-29', end_date: '2027-02-01' }))).toBe('Jan 29–Feb 1, 2027');
    expect(sizeCounts(['AS', 'CL', 'cl', null, 'CXS'])).toEqual([['CXS', 1], ['CL', 2], ['AS', 1]]);
  });
});

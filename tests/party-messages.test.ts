import { describe, expect, it } from 'vitest';
import { partyVars, renderTemplate, longDay } from '../src/lib/templates';
import type { Party } from '../src/lib/parties';

const gym = { name: 'Gym Stars Gymnastics', short_name: 'Gym Stars', phone: '(208) 866-2699', website: 'https://www.gymstarsidaho.com/' };
const party = {
  parent_name: 'Ashley Fox', child_name: null, party_date: '2026-11-07', time_slot: '1:00 – 2:30 PM',
  num_children: 12, total_price: 300, amount_paid: 300,
} as unknown as Party;

describe('party message placeholders', () => {
  it('fills in party details', () => {
    const v = partyVars(party, gym);
    expect(longDay('2026-11-07')).toBe('Saturday, November 7');
    expect(renderTemplate('Hi {{parent_first}}, {{child_first}}: {{party_date}}, {{time_slot}} · {{num_children}} kids · {{amount_paid}} · {{waiver_link}}', v))
      .toBe('Hi Ashley, your child: Saturday, November 7, 1:00 – 2:30 PM · 12 kids · $300 · https://www.gymstarsidaho.com/waiver');
    expect(v.balance).toBe('$0');
  });
});

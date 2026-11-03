import { describe, expect, it } from 'vitest';
import { partyVars, renderTemplate, longDay, weekdayOf } from '../src/lib/templates';
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

describe('requested_day', () => {
  it('pulls just the weekday out of the requested time', () => {
    expect(weekdayOf('Monday at 4:30–5:30 PM')).toBe('Monday');
    expect(weekdayOf('Tue 10:30 AM')).toBe('Tuesday');
    expect(weekdayOf('Sat. 11:15')).toBe('Saturday');
    expect(weekdayOf('4:30 PM')).toBe('');
  });
});

import { emailHtml, plainLinks, templateVars } from '../src/lib/templates';
describe('waiver links', () => {
  const url = 'https://www.gomotionapp.com/Login5.jsp?team=idgs&_tu_Login_Redirect_=%2Fteam%2Fidgs%2Fcontroller%2Fcms%2Fadmin%2Findex%23%2Fmy-account%2Fagreements';
  const body = 'Please [sign the waiver in your parent portal](' + url + ') before class.';
  it('makes a clickable link in the email', () => {
    const html = emailHtml(body, { name: 'Gym Stars', phone: '', address: '', brand_color: '#004380' });
    expect(html).toContain('<a href="' + url.replace(/&/g, '&amp;') + '"');
    expect(html).toContain('>sign the waiver in your parent portal</a> before class.');
  });
  it('spells out the address in texts', () => {
    expect(plainLinks(body)).toBe('Please sign the waiver in your parent portal: ' + url + ' before class.');
    expect(plainLinks('Please [sign the waiver]() now')).toBe('Please sign the waiver now');
  });
  it('uses the gym waiver link for class emails', () => {
    const v = templateVars({ child_name: 'Mia' } as never, { name: 'G', short_name: 'G', phone: '', website: 'https://gymstarsidaho.com', waiver_url: url });
    expect(v.waiver_link).toBe(url);
  });
});

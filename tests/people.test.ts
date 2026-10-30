import { describe, expect, it } from 'vitest';
import { parseGoMotion, className } from '@/lib/people';

describe('parseGoMotion', () => {
  const header = ['Age', 'Birthday', 'Class Membership', 'Gender', 'Memb. First Name', 'Memb. Last Name', 'Account Status', 'Acct. First Name', 'Acct. Last Name', 'Bookings', 'Class Membership', 'Email', 'Mobile/SMS 1', 'Mobile/SMS Status', 'Phone'];
  const rows = [
    header,
    ['', '', '', '', '', '', 'Active', 'McKenna', 'Alvey', '', '', 'McKennaga10@icloud.com', '(208) 670-1311', 'Sent', '(208) 670-1311'],
    ['11', '09/01/2015', '', 'M', 'Omid', 'Ahmadi', 'Active', 'Shanaz', 'Ahmadi', '', '', 'shanaz@yahoo.com', '2086959871', 'Unverified', ''],
    ['6', '09/01/2020', 'Shining Stars | Reg Slot #1', 'F', 'Dunya', 'Ahmadi', 'Active', 'Shanaz', 'Ahmadi', '', 'Shining Stars | Reg Slot #1', 'shanaz@yahoo.com', '2086959871', 'Unverified', ''],
    ['6', '09/01/2020', 'Ninja 1 | Reg Slot #2', 'F', 'Dunya', 'Ahmadi', 'Active', 'Shanaz', 'Ahmadi', '2026 Team Practice Meet | Sat', '', 'shanaz@yahoo.com', '2086959871', 'Unverified', ''],
  ];
  const p = parseGoMotion(rows);
  it('makes one family per email, including families with no athletes', () => {
    expect(p.accounts.map((a) => a.email)).toEqual(['mckennaga10@icloud.com', 'shanaz@yahoo.com']);
    expect(p.accounts[1]).toMatchObject({ first_name: 'Shanaz', mobile: '(208) 695-9871', sms_status: 'Unverified', status: 'active' });
  });
  it('merges an athlete listed on several rows and collects their classes', () => {
    expect(p.members).toHaveLength(2);
    const dunya = p.members.find((m) => m.first_name === 'Dunya')!;
    expect(dunya.birthday).toBe('2020-09-01');
    expect(dunya.classes).toEqual(['Shining Stars | Reg Slot #1', 'Ninja 1 | Reg Slot #2']);
    expect(dunya.bookings).toEqual(['2026 Team Practice Meet | Sat']);
    expect(className(dunya.classes[0])).toBe('Shining Stars');
  });
  it("ignores the account-level class column so siblings don't share classes", () => {
    const q = parseGoMotion([header,
      ['', '01/01/2015', 'STARZ 2 | Reg Slot #1', 'F', 'Elaine', 'B', 'Active', 'Mike', 'B', '', 'STARZ 2 | Reg Slot #1\nTeam - Group C | Reg Slot #1', 'm@x.com', '', '', ''],
      ['', '01/01/2018', 'Team - Group C | Reg Slot #1', 'F', 'Autumn', 'B', 'Active', 'Mike', 'B', '', 'STARZ 2 | Reg Slot #1\nTeam - Group C | Reg Slot #1', 'm@x.com', '', '', '']]);
    expect(q.members.map((m) => m.classes)).toEqual([['STARZ 2 | Reg Slot #1'], ['Team - Group C | Reg Slot #1']]);
  });
});

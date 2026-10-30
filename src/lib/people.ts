/**
 * Turns a GoMotion "custom export" (one row per athlete, or per account with no athletes)
 * into families (accounts) and athletes (members), keyed so a re-import updates instead of duplicating.
 * Pure function: runs in the browser before upload, and in tests.
 */
import { formatPhone, parseDateLoose } from './parse';

export interface AccountRow {
  match_key: string; first_name: string; last_name: string; email: string | null;
  mobile: string | null; phone: string | null; sms_status: string | null; status: string;
}
export interface MemberRow {
  match_key: string; account_key: string; first_name: string; last_name: string;
  birthday: string | null; gender: string | null; classes: string[]; bookings: string[];
}
export interface ParsedPeople { accounts: AccountRow[]; members: MemberRow[]; skipped: number; warnings: string[] }

const norm = (h: unknown) => String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const cell = (v: unknown) => (v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim());

/** Column name variants seen in GoMotion exports. */
const COLS = {
  memberFirst: ['membfirstname', 'memberfirstname', 'athletefirstname', 'firstname'],
  memberLast: ['memblastname', 'memberlastname', 'athletelastname', 'lastname'],
  member: ['member', 'athlete'],
  birthday: ['birthday', 'memberdob', 'dob', 'dateofbirth'],
  gender: ['gender'],
  classes: ['classmembership', 'registeredclass', 'class'],
  bookings: ['bookings'],
  acctFirst: ['acctfirstname', 'accountfirstname', 'parentfirstname'],
  acctLast: ['acctlastname', 'accountlastname', 'parentlastname'],
  account: ['account', 'parent'],
  email: ['email', 'emailaddress', 'acctemail'],
  mobile: ['mobilesms1', 'mobile', 'cell'],
  smsStatus: ['mobilesmsstatus', 'smsstatus'],
  phone: ['phone', 'homephone'],
  status: ['accountstatus', 'status'],
};

/** "Last, First" → [first, last] */
function splitComma(s: string): [string, string] {
  const i = s.indexOf(',');
  return i < 0 ? [s.trim(), ''] : [s.slice(i + 1).trim(), s.slice(0, i).trim()];
}

export function parseGoMotion(table: unknown[][]): ParsedPeople {
  const warnings: string[] = [];
  const headerIdx = table.findIndex((r) => r.some((c) => ['email', 'acctfirstname', 'account', 'member', 'membfirstname'].includes(norm(c))));
  if (headerIdx < 0) return { accounts: [], members: [], skipped: table.length, warnings: ['Could not find the header row. Is this a GoMotion export?'] };
  const header = table[headerIdx].map(norm);
  // A column can appear twice (GoMotion repeats "Class Membership"): keep every index.
  const idx = (names: string[]) => header.flatMap((h, i) => (names.includes(h) ? [i] : []));
  const col = Object.fromEntries(Object.entries(COLS).map(([k, v]) => [k, idx(v)])) as Record<keyof typeof COLS, number[]>;
  // GoMotion lists member fields before account fields. A "Class Membership" column in the account
  // section lists every class on the account (all siblings), so only keep ones in the member section.
  const accountStart = Math.min(...[...col.acctFirst, ...col.acctLast, ...col.account, ...col.status].concat(header.length));
  const accountLevelClasses = col.classes.filter((i) => i > accountStart);
  col.classes = col.classes.filter((i) => i < accountStart);
  const get = (r: unknown[], k: keyof typeof COLS) => (col[k].length ? cell(r[col[k][0]]) : '');
  const getAll = (r: unknown[], k: keyof typeof COLS) => col[k].map((i) => cell(r[i])).filter(Boolean);

  const accounts = new Map<string, AccountRow>();
  const members = new Map<string, MemberRow>();
  let skipped = 0;

  for (const r of table.slice(headerIdx + 1)) {
    if (!r || r.every((c) => cell(c) === '')) continue;
    let [af, al] = [get(r, 'acctFirst'), get(r, 'acctLast')];
    if (!af && !al && get(r, 'account')) [af, al] = splitComma(get(r, 'account'));
    const email = get(r, 'email').toLowerCase() || null;
    const mobile = get(r, 'mobile') ? formatPhone(get(r, 'mobile')) : null;
    const phone = get(r, 'phone') ? formatPhone(get(r, 'phone')) : null;
    if (!email && !af && !al) { skipped++; continue; }
    const akey = email ?? `name:${`${af} ${al}`.toLowerCase().trim()}|${(mobile ?? phone ?? '').replace(/\D/g, '')}`;

    const prev = accounts.get(akey);
    accounts.set(akey, {
      match_key: akey,
      first_name: prev?.first_name || af,
      last_name: prev?.last_name || al,
      email,
      mobile: prev?.mobile || mobile,
      phone: prev?.phone || phone,
      sms_status: prev?.sms_status || get(r, 'smsStatus') || null,
      status: (get(r, 'status') || prev?.status || 'active').toLowerCase(),
    });

    let [mf, ml] = [get(r, 'memberFirst'), get(r, 'memberLast')];
    if (!mf && !ml && get(r, 'member')) [mf, ml] = splitComma(get(r, 'member'));
    if (!mf) continue; // account with no athletes
    const birthday = parseDateLoose(get(r, 'birthday'));
    const mkey = `${akey}|${`${mf} ${ml}`.toLowerCase()}|${birthday ?? ''}`;
    // GoMotion repeats "Class Membership": the first one is this athlete's classes, the second is the
    // whole account's (all siblings). Only use the first, or siblings get each other's classes.
    const classes = get(r, 'classes').split(/\n|;/).map((c) => c.trim()).filter(Boolean);
    const bookings = getAll(r, 'bookings').flatMap((c) => c.split(/\n|;/)).map((c) => c.trim()).filter(Boolean);
    const m = members.get(mkey);
    members.set(mkey, {
      match_key: mkey, account_key: akey, first_name: mf, last_name: ml, birthday,
      gender: m?.gender || get(r, 'gender') || null,
      classes: [...new Set([...(m?.classes ?? []), ...classes])],
      bookings: [...new Set([...(m?.bookings ?? []), ...bookings])],
    });
  }
  if (accountLevelClasses.length && !col.classes.length) warnings.push('This file only has the account-level "Class Membership" column, which mixes siblings\' classes, so classes were skipped. Import the New Registrations report to fill in classes.');
  if (!col.email.length) warnings.push('No Email column found. Families are matched by name and phone instead.');
  return { accounts: [...accounts.values()], members: [...members.values()], skipped, warnings };
}

/** "Shining Stars | Reg Slot #8" → "Shining Stars" */
export const className = (c: string) => c.split('|')[0].trim();

/* ───────── GoMotion "New Registrations" report → class registrations ───────── */

export interface RegistrationRow {
  match_key: string; member_name: string; first_name: string; last_name: string; birthday: string | null;
  account_name: string | null; phone: string | null; class_name: string; slot: string | null; payment_plan: string | null;
  registered_on: string | null; start_date: string | null; drop_date: string | null; waitlisted: boolean;
}

export function isRegistrationsReport(table: unknown[][]) {
  return table.slice(0, 5).some((r) => r.some((c) => norm(c) === 'registeredclass'));
}

export function parseRegistrations(table: unknown[][]): { rows: RegistrationRow[]; warnings: string[] } {
  const hi = table.findIndex((r) => r.some((c) => norm(c) === 'registeredclass'));
  if (hi < 0) return { rows: [], warnings: ['Could not find the "Registered Class" column.'] };
  const h = table[hi].map(norm);
  const at = (name: string) => h.indexOf(name);
  const g = (r: unknown[], name: string) => (at(name) >= 0 ? cell(r[at(name)]) : '');
  const out = new Map<string, RegistrationRow>();
  for (const r of table.slice(hi + 1)) {
    const member = g(r, 'member'); const cls = g(r, 'registeredclass');
    if (!member || !cls) continue;
    const [first, last] = splitComma(member);
    const birthday = parseDateLoose(g(r, 'memberdob'));
    const sd = g(r, 'startdropdate');
    const start = sd.match(/S:\s*([\d/]+)/)?.[1]; const drop = sd.match(/D:\s*([\d/]+)/)?.[1];
    const registered_on = parseDateLoose(g(r, 'dateofregistration'));
    const slot = g(r, 'slot') || null;
    const key = [`${first} ${last}`.toLowerCase(), birthday ?? '', cls.toLowerCase(), slot ?? '', registered_on ?? ''].join('|');
    const acct = g(r, 'account');
    out.set(key, {
      match_key: key, member_name: `${first} ${last}`.trim(), first_name: first, last_name: last, birthday,
      account_name: acct ? splitComma(acct).join(' ').trim() : null,
      phone: g(r, 'phone') ? formatPhone(g(r, 'phone')) : null,
      class_name: cls, slot, payment_plan: g(r, 'registeredpaymentplan') || null, registered_on,
      start_date: start ? parseDateLoose(start) : null, drop_date: drop ? parseDateLoose(drop) : null,
      waitlisted: /^y/i.test(g(r, 'waitlist')),
    });
  }
  return { rows: [...out.values()], warnings: [] };
}

export type RegState = 'active' | 'upcoming' | 'waitlist' | 'dropped';
export function regState(r: { waitlisted: boolean; start_date: string | null; drop_date: string | null }, today: string): RegState {
  if (r.waitlisted) return 'waitlist';
  if (r.drop_date && r.drop_date <= today) return 'dropped';
  if (r.start_date && r.start_date > today) return 'upcoming';
  return 'active';
}

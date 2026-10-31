/** Competition team: athletes, meets, practice groups, comp fees. */

export const LEVELS = ['Level 1', 'Level 2', 'Level 3', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'] as const;
export const GROUP_NAMES = ['Group A', 'Group B', 'Group C', 'Group D', 'Group E', 'Group F', 'Level 1'] as const;
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export const FEE_PLANS = ['4 payments', 'Pay in full'] as const;
export const PAYMENT_DATES = ['Aug 15', 'Sep 15', 'Oct 15', 'Nov 15'] as const;

export interface TeamAthlete {
  id: string; gym_id: string; name: string; level: string | null; group_name: string | null; hours: number | null;
  is_new: boolean; contract_signed: boolean; usag_member: boolean; backpack_needed: boolean; backpack_given: boolean;
  comp_leo_size: string | null; practice_leo_size: string | null; practice_leo_received: boolean; warmup_size: string | null;
  mom_email: string | null; dad_email: string | null; notes: string | null; active: boolean;
}
export interface TeamMeet {
  id: string; gym_id: string; name: string; start_date: string | null; end_date: string | null; location: string | null;
  required: boolean; levels: string[]; fees: Record<string, number>; team_fee: number; notes: string | null;
}
export interface TeamEntry { meet_id: string; athlete_id: string }
export interface Practice { day: string; time: string; coach: string }
export interface TeamGroup { id: string; gym_id: string; name: string; label: string | null; practices: Practice[]; sort: number }
export interface TeamFee {
  athlete_id: string; gym_id: string; total: number | null; plan: string | null;
  paid_1: boolean; paid_2: boolean; paid_3: boolean; paid_4: boolean; notes: string | null;
}
export interface TeamExpense { id: string; gym_id: string; label: string; amount: number; sort: number }

export const levelRank = (l: string | null) => { const i = LEVELS.indexOf((l ?? '') as (typeof LEVELS)[number]); return i < 0 ? 99 : i; };
export const byLevelThenName = (a: Pick<TeamAthlete, 'level' | 'name'>, b: Pick<TeamAthlete, 'level' | 'name'>) =>
  levelRank(a.level) - levelRank(b.level) || a.name.localeCompare(b.name);

/** Does this athlete's level compete at this meet? */
export const eligible = (a: Pick<TeamAthlete, 'level'>, m: Pick<TeamMeet, 'levels'>) => !m.levels.length || (!!a.level && m.levels.includes(a.level));

/** Required meets this athlete's level goes to that they're not signed up for. */
export function missingRequired(a: TeamAthlete, meets: TeamMeet[], entries: TeamEntry[]) {
  return meets.filter((m) => m.required && eligible(a, m) && !entries.some((e) => e.meet_id === m.id && e.athlete_id === a.id));
}

/** Entry fees for a meet: each athlete's fee for their level, plus one team fee per level entered. */
export function meetCost(m: TeamMeet, athletes: TeamAthlete[], entries: TeamEntry[]) {
  const ids = new Set(entries.filter((e) => e.meet_id === m.id).map((e) => e.athlete_id));
  const byLevel = new Map<string, number>();
  athletes.filter((a) => ids.has(a.id)).forEach((a) => byLevel.set(a.level ?? '—', (byLevel.get(a.level ?? '—') ?? 0) + 1));
  let total = 0; let unknown = false;
  const rows = [...byLevel].sort((x, y) => levelRank(x[0]) - levelRank(y[0])).map(([level, count]) => {
    const fee = m.fees[level];
    if (fee == null) unknown = true;
    const sub = (fee ?? 0) * count + (count ? Number(m.team_fee || 0) : 0);
    total += sub;
    return { level, count, fee: fee ?? null, subtotal: sub };
  });
  return { rows, total, unknown, count: ids.size };
}

/** Amount paid so far on an athlete's comp fees. */
export function feePaid(f: TeamFee | undefined) {
  if (!f || f.total == null) return 0;
  if (f.plan === 'Pay in full') return f.paid_1 ? Number(f.total) : 0;
  return ([f.paid_1, f.paid_2, f.paid_3, f.paid_4].filter(Boolean).length * Number(f.total)) / 4;
}

/** Count of each size, in a sensible order. */
export function sizeCounts(values: (string | null)[]) {
  const order = ['CXS', 'CS', 'CM', 'CL', 'CXL', 'AXS', 'AS', 'AM', 'AL', 'AXL', '120', '130', '140', '150', '160'];
  const c = new Map<string, number>();
  values.forEach((v) => { const k = (v ?? '').trim().toUpperCase(); if (k) c.set(k, (c.get(k) ?? 0) + 1); });
  return [...c].sort((a, b) => (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99) || a[0].localeCompare(b[0]));
}

export function meetDates(m: Pick<TeamMeet, 'start_date' | 'end_date'>) {
  const f = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', ...o });
  if (!m.start_date) return 'Date TBD';
  if (!m.end_date || m.end_date === m.start_date) return f(m.start_date, { month: 'short', day: 'numeric', year: 'numeric' });
  const sameMonth = m.start_date.slice(0, 7) === m.end_date.slice(0, 7);
  const end = sameMonth ? `${Number(m.end_date.slice(8, 10))}, ${m.end_date.slice(0, 4)}` : f(m.end_date, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${f(m.start_date, { month: 'short', day: 'numeric' })}–${end}`;
}

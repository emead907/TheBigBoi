import 'server-only';

/**
 * Jackrabbit's public class openings feed. No login: it's the same data the
 * gym's online registration page shows. Fields per Jackrabbit's OpeningsJson docs.
 */
export interface JRClass {
  id: string; name: string; category: string; room: string; location: string; locationCode: string;
  days: string[]; start: string; end: string; startDate: string | null; endDate: string | null;
  minAge: string; maxAge: string; gender: string; instructors: string[];
  openings: number | null; waitlistOnly: boolean; tuition: number | null; regLink: string | null;
}

const DAY_KEYS: [string, string][] = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']];
type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v));
const num = (v: unknown) => { const n = typeof v === 'number' ? v : parseFloat(str(v)); return Number.isFinite(n) ? n : null; };

/** "16:30", "16:30:00" or "4:30 PM" → "4:30 PM" */
export function clock(v: unknown): string {
  const s = str(v);
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/) ?? s.match(/T(\d{2}):(\d{2})/);
  if (!m) return s;
  let h = Number(m[1]); const min = m[2]; const ap = m[3]?.toUpperCase();
  if (ap) return `${h}:${min} ${ap}`;
  const pm = h >= 12; h = h % 12 || 12;
  return `${h}:${min} ${pm ? 'PM' : 'AM'}`;
}

/** ISO 8601 duration "P3Y6M" → "3y 6m"; plain numbers pass through. */
export function age(v: unknown): string {
  const s = str(v);
  const m = s.match(/^P(?:(\d+)Y)?(?:(\d+)M)?/);
  if (!m || (!m[1] && !m[2])) return s;
  const y = Number(m[1] ?? 0), mo = Number(m[2] ?? 0);
  return mo ? (y ? `${y}y ${mo}m` : `${mo}m`) : `${y}`;
}

export function parseClass(r: Raw): JRClass {
  const md = (r.meeting_days ?? {}) as Raw;
  const op = (r.openings ?? {}) as Raw;
  const tu = (r.tuition ?? {}) as Raw;
  const ins = Array.isArray(r.instructors) ? (r.instructors as unknown[]).map(str).filter(Boolean) : str(r.instructors) ? [str(r.instructors)] : [];
  return {
    id: str(r.id), name: str(r.name), category: str(r.category1), room: str(r.room),
    location: str(r.location_name) || str(r.location), locationCode: str(r.location_code),
    days: DAY_KEYS.filter(([k]) => md[k] === true || md[k] === 'true' || md[k] === 1).map(([, l]) => l),
    start: clock(r.start_time), end: clock(r.end_time),
    startDate: str(r.start_date) || null, endDate: str(r.end_date) || null,
    minAge: age(r.min_age), maxAge: age(r.max_age), gender: str(r.gender), instructors: ins,
    openings: num(op.calculated_openings ?? r.openings),
    waitlistOnly: r.waitlist === true || r.waitlist === 'true',
    tuition: num(tu.fee), regLink: str(r.online_reg_link) || null,
  };
}

/** Classes at one location. Matches the location name or code, ignoring case. Blank location = every class. */
export function atLocation(classes: JRClass[], location: string | null | undefined) {
  const want = (location ?? '').trim().toLowerCase();
  if (!want) return classes;
  return classes.filter((c) => c.location.toLowerCase().includes(want) || c.locationCode.toLowerCase() === want);
}

/** Fetches the gym's classes. Cached for 10 minutes. */
export async function fetchClasses(orgId: string): Promise<{ ok: true; classes: JRClass[] } | { ok: false; error: string }> {
  const tries: [string, RequestInit][] = [
    ['https://app.jackrabbitclass.com/jr4.0/Openings/OpeningsJson',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ OrgId: orgId }) }],
    [`https://app.jackrabbitclass.com/jr3.0/Openings/OpeningsJson?OrgID=${encodeURIComponent(orgId)}`, { method: 'GET' }],
  ];
  let last = '';
  for (const [url, init] of tries) {
    try {
      const res = await fetch(url, { ...init, next: { revalidate: 600 }, signal: AbortSignal.timeout(10000) });
      if (!res.ok) { last = `Jackrabbit answered ${res.status}.`; continue; }
      const json = (await res.json()) as Raw;
      const rows = Array.isArray(json.rows) ? json.rows : Array.isArray(json) ? json : null;
      if (!rows) { last = 'Jackrabbit sent something unexpected.'; continue; }
      return { ok: true, classes: (rows as Raw[]).map(parseClass).filter((c) => c.name) };
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
  }
  return { ok: false, error: last || 'Could not reach Jackrabbit.' };
}

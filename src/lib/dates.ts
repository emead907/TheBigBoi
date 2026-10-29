/** "YYYY-MM-DD" for a moment in the gym's time zone. */
export function ymdInZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Adds whole days to a "YYYY-MM-DD" string. */
export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** "Mon, Nov 2" from "YYYY-MM-DD" (no time-zone shifting). */
export function formatDay(ymd: string | null | undefined, opts: { year?: boolean } = {}): string {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', ...(opts.year ? { year: 'numeric' } : {}),
  });
}

export function formatDateTime(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/** Age like "8 yrs" or "2 yr 4 mo" on a given day. */
export function ageOn(birthday: string | null | undefined, todayYmd: string): string {
  if (!birthday) return '';
  const [by, bm, bd] = birthday.split('-').map(Number);
  const [ty, tm, td] = todayYmd.split('-').map(Number);
  let months = (ty - by) * 12 + (tm - bm);
  if (td < bd) months -= 1;
  if (months < 0) return '';
  const y = Math.floor(months / 12);
  const mo = months % 12;
  return y < 3 ? `${y} yr ${mo} mo` : `${y} yrs`;
}

export function daysBetween(fromYmd: string, toYmd: string): number {
  const a = Date.parse(fromYmd + 'T00:00:00Z');
  const b = Date.parse(toYmd + 'T00:00:00Z');
  return Math.round((b - a) / 86_400_000);
}

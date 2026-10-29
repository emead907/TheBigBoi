import type { Trial } from './types';
import { addDays, daysBetween, ymdInZone } from './dates';

export interface Funnel { requested: number; scheduled: number; showed: number; enrolled: number; decided: number; rate: number | null }

type T = Pick<Trial, 'received_at' | 'first_day' | 'showed_up' | 'status' | 'class_name' | 'spot_email_sent_at' | 'closed_at'>;

export function funnel(trials: T[]): Funnel {
  const enrolled = trials.filter((t) => t.status === 'enrolled').length;
  const decided = trials.filter((t) => t.status !== 'open').length;
  return {
    requested: trials.length,
    scheduled: trials.filter((t) => t.first_day).length,
    showed: trials.filter((t) => t.showed_up === true || t.status === 'enrolled').length,
    enrolled,
    decided,
    rate: decided ? enrolled / decided : null,
  };
}

export function inLastDays<X extends Pick<T, 'received_at'>>(trials: X[], today: string, days: number, tz: string, offsetDays = 0): X[] {
  const end = addDays(today, -offsetDays);
  const since = addDays(end, -days);
  return trials.filter((t) => {
    const d = ymdInZone(new Date(t.received_at), tz);
    return d > since && d <= end;
  });
}

export function byClass(trials: T[]) {
  const map = new Map<string, T[]>();
  trials.forEach((t) => {
    const k = (t.class_name || 'No class listed').trim();
    map.set(k, [...(map.get(k) ?? []), t]);
  });
  return [...map.entries()].map(([name, list]) => ({ name, ...funnel(list) })).sort((a, b) => b.requested - a.requested);
}

export function byMonth(trials: T[], today: string, tz: string, months = 6) {
  const [y, m] = today.split('-').map(Number);
  const out: { key: string; label: string; requested: number; enrolled: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = d.toISOString().slice(0, 7);
    out.push({ key, label: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }), requested: 0, enrolled: 0 });
  }
  trials.forEach((t) => {
    const rk = ymdInZone(new Date(t.received_at), tz).slice(0, 7);
    const r = out.find((o) => o.key === rk);
    if (r) r.requested++;
    if (t.status === 'enrolled' && t.closed_at) {
      const e = out.find((o) => o.key === ymdInZone(new Date(t.closed_at!), tz).slice(0, 7));
      if (e) e.enrolled++;
    }
  });
  return out;
}

/** Average days from request to first day, and share of spot emails sent within a day. */
export function speed(trials: T[], tz: string) {
  const waits = trials.filter((t) => t.first_day).map((t) => daysBetween(ymdInZone(new Date(t.received_at), tz), t.first_day!)).filter((d) => d >= 0);
  const withEmail = trials.filter((t) => t.spot_email_sent_at);
  const fast = withEmail.filter((t) => Date.parse(t.spot_email_sent_at!) - Date.parse(t.received_at) <= 86_400_000).length;
  return {
    avgDaysToFirstDay: waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : null,
    spotWithinDay: withEmail.length ? fast / withEmail.length : null,
  };
}

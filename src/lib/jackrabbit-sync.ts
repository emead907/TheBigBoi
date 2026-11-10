import 'server-only';
import { timingSafeEqual } from 'crypto';

/**
 * Two-way Jackrabbit hookup for the Nest hubs, through Zapier:
 *  - "Add to Jackrabbit" on a request sends the family to a Zapier catch hook
 *    (JACKRABBIT_ADD_HOOK_URL), which creates the family, contact and student
 *    and reports back to /api/jackrabbit/added.
 *  - Zapier's Jackrabbit "Student Enrolled" trigger posts to
 *    /api/jackrabbit/enrollment, which schedules the matching request.
 * For now only the Nampa hub has these turned on.
 */
export const JACKRABBIT_SYNC_HUBS = new Set(['gym-nest']);
export const jackrabbitSyncOn = (slug: string) => JACKRABBIT_SYNC_HUBS.has(slug);

/** "Mary Ann Smith" → { first: "Mary Ann", last: "Smith" } */
export function splitName(full: string | null | undefined): { first: string; last: string } {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] ?? '', last: '' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

/** "5:15pm" / "17:15" → "5:15 PM" */
export function niceTime(v: string | null | undefined): string | null {
  const s = (v ?? '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})\s*([ap])\.?m?\.?$/i);
  if (m) return `${Number(m[1])}:${m[2]} ${m[3].toUpperCase()}M`;
  const h = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (h) { const hr = Number(h[1]); return `${hr % 12 || 12}:${h[2]} ${hr >= 12 ? 'PM' : 'AM'}`; }
  return s || null;
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

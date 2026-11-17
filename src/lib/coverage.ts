export interface CoverageSlot {
  id: string;
  gym_id: string;
  day: string;
  kind: 'camp' | 'opengym' | 'class' | 'team' | string;
  name: string;
  time_label: string | null;
  start_min: number | null;
  room: string | null;
  coach: string | null;
  status: 'in' | 'out' | null;
  cover: string | null;
  updated_by: string | null;
  updated_at: string;
}

export type CoveragePatch = Partial<Pick<CoverageSlot, 'coach' | 'status' | 'cover'>>;

export type SlotState = 'need' | 'nocoach' | 'ok';

/** Out with nobody covering = needs coverage; no coach yet = unassigned; otherwise covered. */
export function slotState(s: Pick<CoverageSlot, 'coach' | 'status' | 'cover'>): SlotState {
  if (!s.coach?.trim()) return 'nocoach';
  if (s.status === 'out' && !s.cover?.trim()) return 'need';
  return 'ok';
}

/** "4:30-5:30" → 990. Hours before 8 are treated as PM (gym never opens before 8). */
export function startMinutes(t: string | null | undefined): number | null {
  const m = /(\d{1,2}):(\d{2})/.exec(t ?? '');
  if (!m) return null;
  let h = Number(m[1]);
  if (h < 8) h += 12;
  return h * 60 + Number(m[2]);
}

export const KIND_ORDER: [string, string][] = [['camp', 'Camp'], ['opengym', 'Open gym'], ['class', 'Classes'], ['team', 'Team']];

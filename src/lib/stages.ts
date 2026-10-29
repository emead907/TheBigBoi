import type { Trial } from './types';

export type Stage = 'waitlist' | 'new' | 'upcoming' | 'today' | 'follow_up' | 'enrolled' | 'closed';

export const STAGES: { key: Stage; label: string; hint: string }[] = [
  { key: 'waitlist', label: 'Waitlist', hint: 'Families waiting for a spot, grouped by class, oldest first. Click Offer spot when one opens.' },
  { key: 'new', label: 'New Requests', hint: 'Add to SportsEngine, send the spot email, and set a first day.' },
  { key: 'upcoming', label: 'Upcoming First Days', hint: 'First day is scheduled. A reminder goes out the night before.' },
  { key: 'today', label: 'First Day Today', hint: 'Mark who showed up.' },
  { key: 'follow_up', label: 'Follow-Up', hint: 'Find out if they are enrolling.' },
  { key: 'enrolled', label: 'Enrolled', hint: 'Signed up for classes.' },
  { key: 'closed', label: 'Not Enrolled', hint: 'Not enrolling or no-show.' },
];

type StageInput = Pick<Trial, 'status' | 'first_day'> & Partial<Pick<Trial, 'waitlisted_at' | 'offered_at'>>;

/** Where a trial sits on the board, given today's date in the gym's time zone. */
export function stageOf(t: StageInput, todayYmd: string): Stage {
  if (t.status === 'enrolled') return 'enrolled';
  if (t.status === 'not_enrolling' || t.status === 'no_show') return 'closed';
  if (t.waitlisted_at && !t.offered_at && !t.first_day) return 'waitlist';
  if (!t.first_day) return 'new';
  if (t.first_day > todayYmd) return 'upcoming';
  if (t.first_day === todayYmd) return 'today';
  return 'follow_up';
}

export const STATUS_LABEL: Record<Trial['status'], string> = {
  open: 'In progress',
  enrolled: 'Enrolled',
  not_enrolling: 'Not enrolling',
  no_show: 'No-show',
};

/** Checklist items still to do for a trial in its current stage. */
export function nextSteps(t: Trial, stage: Stage): string[] {
  const out: string[] = [];
  if (stage === 'new') {
    if (!t.in_sportsengine) out.push('Add to SportsEngine');
    if (!t.spot_email_sent_at) out.push('Send spot email');
    if (!t.called_at) out.push('Call');
    out.push('Set first day');
  }
  if (stage === 'today' && t.showed_up == null) out.push('Mark attendance');
  if (stage === 'follow_up' && !t.followed_up_at) out.push('Follow up');
  return out;
}

/** Waitlist position within the same class and time, oldest first. Key: trial id → 1-based position. */
export function waitlistPositions(trials: Pick<Trial, 'id' | 'class_name' | 'requested_time' | 'waitlisted_at'>[]): Record<string, number> {
  const groups = new Map<string, typeof trials>();
  trials.forEach((t) => {
    const k = `${(t.class_name ?? '').trim().toLowerCase()}|${(t.requested_time ?? '').trim().toLowerCase()}`;
    groups.set(k, [...(groups.get(k) ?? []), t]);
  });
  const out: Record<string, number> = {};
  groups.forEach((list) => {
    [...list].sort((a, b) => (a.waitlisted_at ?? '').localeCompare(b.waitlisted_at ?? ''))
      .forEach((t, i) => { out[t.id] = i + 1; });
  });
  return out;
}

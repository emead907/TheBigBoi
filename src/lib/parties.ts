/** Birthday parties: stages, time slots and pricing helpers. */

export type PartyStatus = 'inquiry' | 'booked' | 'completed' | 'cancelled' | 'not_booked';
export type PartyStage = 'inquiry' | 'upcoming' | 'past' | 'closed';

export interface Party {
  id: string; gym_id: string; source: string; received_at: string; status: PartyStatus;
  parent_name: string | null; parent_email: string | null; parent_phone: string | null;
  child_name: string | null; child_age: string | null; party_date: string | null; time_slot: string | null;
  num_children: number | null; children_ages: string | null; theme: string | null; add_ons: string[];
  package: 'party_room' | 'gym_only'; comments: string | null;
  total_price: number | null; amount_paid: number; paid_at: string | null; contacted_at: string | null;
  confirmed_at: string | null; coach: string | null; notes: string | null; external_id: string | null;
}

/** Same slots as the website's party form (gym-stars-website/app/lib/birthdaySlots.ts). */
export const PARTY_SLOTS: Record<'Saturday' | 'Sunday', string[]> = {
  Saturday: ['1:00 – 2:30 PM', '3:00 – 4:30 PM'],
  Sunday: ['11:00 AM – 12:30 PM', '1:00 – 2:30 PM'],
};
export const ADD_ONS = ['Goodie Bags', 'Balloons', 'Cupcakes', 'Pizza', 'Socks', 'Additional Kids'];
export const BASE_PRICE = 265;
export const NON_REFUNDABLE = 50;

export const PARTY_STAGES: { key: PartyStage; label: string; hint: string }[] = [
  { key: 'inquiry', label: 'New Inquiries', hint: 'Reach out, confirm the date and time, and collect payment to book.' },
  { key: 'upcoming', label: 'Booked', hint: 'Paid and on the calendar. Send a confirmation and assign a coach.' },
  { key: 'past', label: 'Past Parties', hint: 'Parties that already happened.' },
  { key: 'closed', label: 'Not Booked', hint: 'Cancelled, or the family didn’t book.' },
];

export function partyStage(p: Pick<Party, 'status' | 'party_date'>, today: string): PartyStage {
  if (p.status === 'cancelled' || p.status === 'not_booked') return 'closed';
  if (p.status === 'completed') return 'past';
  if (p.status === 'booked') return p.party_date && p.party_date < today ? 'past' : 'upcoming';
  return 'inquiry';
}

export function dayName(ymd: string | null | undefined): 'Saturday' | 'Sunday' | null {
  if (!ymd) return null;
  const d = new Date(ymd + 'T12:00:00Z').getUTCDay();
  return d === 6 ? 'Saturday' : d === 0 ? 'Sunday' : null;
}

/** Other parties already booked for the same date and time. */
export function conflicts(p: Pick<Party, 'id' | 'party_date' | 'time_slot'>, all: Pick<Party, 'id' | 'party_date' | 'time_slot' | 'status'>[]) {
  if (!p.party_date || !p.time_slot) return [];
  return all.filter((o) => o.id !== p.id && o.status === 'booked' && o.party_date === p.party_date && o.time_slot === p.time_slot);
}

export const balance = (p: Pick<Party, 'total_price' | 'amount_paid'>) => Math.max(0, (p.total_price ?? 0) - (p.amount_paid ?? 0));
export const money = (n: number | null | undefined) => (n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`);

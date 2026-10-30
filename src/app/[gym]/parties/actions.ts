'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getGymContext } from '@/lib/gym';
import { formatPhone } from '@/lib/parse';
import { formatDay } from '@/lib/dates';
import type { Party } from '@/lib/parties';

type Result = { ok: true; message?: string } | { ok: false; error: string };
const EDITABLE = ['status', 'parent_name', 'parent_email', 'parent_phone', 'child_name', 'child_age', 'party_date', 'time_slot',
  'num_children', 'children_ages', 'theme', 'add_ons', 'package', 'total_price', 'amount_paid', 'paid_at', 'contacted_at',
  'confirmed_at', 'coach', 'notes'] as const;
export type PartyPatch = Partial<Pick<Party, (typeof EDITABLE)[number]>>;

const STATUS_TEXT: Record<string, string> = { inquiry: 'Inquiry', booked: 'Booked', completed: 'Completed', cancelled: 'Cancelled', not_booked: 'Not booked' };

function describe(p: PartyPatch): string[] {
  const has = (k: keyof PartyPatch) => Object.prototype.hasOwnProperty.call(p, k);
  const out: string[] = [];
  if (has('status')) out.push(`Status: ${STATUS_TEXT[p.status!]}`);
  if (has('party_date') || has('time_slot')) out.push(`Party set for ${[p.party_date && formatDay(p.party_date), p.time_slot].filter(Boolean).join(', ') || 'no date'}`);
  if (has('contacted_at')) out.push(p.contacted_at ? 'Marked contacted' : 'Unchecked contacted');
  if (has('paid_at')) out.push(p.paid_at ? 'Marked paid' : 'Unchecked paid');
  if (has('amount_paid') && !has('paid_at')) out.push(`Amount paid: $${p.amount_paid}`);
  if (has('confirmed_at')) out.push(p.confirmed_at ? 'Confirmation sent' : 'Unchecked confirmation');
  if (has('coach')) out.push(p.coach ? `Coach: ${p.coach}` : 'Coach cleared');
  if (has('total_price')) out.push(`Price: $${p.total_price ?? 0}`);
  if (has('notes')) out.push('Updated notes');
  if ((['parent_name', 'parent_email', 'parent_phone', 'child_name', 'child_age', 'num_children', 'children_ages', 'theme', 'add_ons', 'package'] as const).some(has)) out.push('Updated party details');
  return out;
}

export async function updateParty(slug: string, id: string, raw: PartyPatch): Promise<Result> {
  const ctx = await getGymContext(slug);
  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in raw) patch[k] = (raw as Record<string, unknown>)[k];
  if (typeof patch.parent_phone === 'string') patch.parent_phone = formatPhone(patch.parent_phone);
  if (patch.party_date === '') patch.party_date = null;
  const db = createClient();
  const { error } = await db.from('parties').update(patch).eq('id', id).eq('gym_id', ctx.gym.id);
  if (error) return { ok: false, error: error.message };
  const lines = describe(raw);
  if (lines.length) await db.from('activity').insert(lines.map((detail) => ({ gym_id: ctx.gym.id, party_id: id, user_id: ctx.userId, actor: ctx.actor, kind: 'update', detail })));
  revalidatePath(`/${slug}/parties`, 'layout');
  return { ok: true };
}

export async function createParty(slug: string, form: FormData): Promise<Result> {
  const ctx = await getGymContext(slug);
  const s = (k: string) => String(form.get(k) ?? '').trim() || null;
  const num = (k: string) => (s(k) && !Number.isNaN(Number(s(k))) ? Number(s(k)) : null);
  const row = {
    gym_id: ctx.gym.id, source: s('source') ?? 'manual', status: form.get('booked') === 'on' ? 'booked' : 'inquiry',
    parent_name: s('parent_name'), parent_email: s('parent_email'), parent_phone: s('parent_phone') ? formatPhone(s('parent_phone')!) : null,
    child_name: s('child_name'), child_age: s('child_age'), party_date: s('party_date'), time_slot: s('time_slot'),
    num_children: num('num_children'), children_ages: s('children_ages'), theme: s('theme'),
    add_ons: form.getAll('add_ons').map(String), package: s('package') === 'gym_only' ? 'gym_only' : 'party_room',
    total_price: num('total_price'), notes: s('notes'), comments: s('comments'),
  };
  const { data, error } = await createClient().from('parties').insert(row).select('id').single();
  if (error) return { ok: false, error: error.message };
  await createClient().from('activity').insert({ gym_id: ctx.gym.id, party_id: data.id, user_id: ctx.userId, actor: ctx.actor, kind: 'created', detail: 'Party added' });
  revalidatePath(`/${slug}/parties`, 'layout');
  redirect(`/${slug}/parties/${data.id}`);
}

export async function deleteParty(slug: string, id: string, opts: { stay?: boolean } = {}): Promise<Result> {
  const ctx = await getGymContext(slug);
  if (ctx.role !== 'owner') return { ok: false, error: 'Only managers can delete parties.' };
  const { error } = await createClient().from('parties').delete().eq('id', id).eq('gym_id', ctx.gym.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/${slug}/parties`, 'layout');
  if (opts.stay) return { ok: true };
  redirect(`/${slug}/parties`);
}

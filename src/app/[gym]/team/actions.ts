'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getGymContext } from '@/lib/gym';
import type { Practice, TeamAthlete, TeamFee, TeamMeet } from '@/lib/team';

type Result = { ok: true; message?: string } | { ok: false; error: string };

const ATHLETE_FIELDS = ['name', 'level', 'group_name', 'hours', 'is_new', 'contract_signed', 'usag_member', 'backpack_needed',
  'backpack_given', 'comp_leo_size', 'practice_leo_size', 'practice_leo_received', 'warmup_size', 'mom_email', 'dad_email', 'notes', 'active'] as const;
export type AthletePatch = Partial<Pick<TeamAthlete, (typeof ATHLETE_FIELDS)[number]>>;

const clean = (v: unknown) => (typeof v === 'string' ? v.trim() || null : v);
const done = (slug: string) => revalidatePath(`/${slug}/team`, 'layout');

export async function updateAthlete(slug: string, id: string, raw: AthletePatch): Promise<Result> {
  const ctx = await getGymContext(slug);
  const patch: Record<string, unknown> = {};
  for (const k of ATHLETE_FIELDS) if (k in raw) patch[k] = clean((raw as Record<string, unknown>)[k]);
  if ('hours' in patch) patch.hours = patch.hours === null || patch.hours === '' ? null : Number(patch.hours);
  if ('name' in patch && !patch.name) return { ok: false, error: 'Name is required.' };
  const { error } = await createClient().from('team_athletes').update(patch).eq('id', id).eq('gym_id', ctx.gym.id);
  if (error) return { ok: false, error: error.message };
  done(slug);
  return { ok: true };
}

export async function createAthlete(slug: string, form: FormData): Promise<Result> {
  const ctx = await getGymContext(slug);
  const s = (k: string) => String(form.get(k) ?? '').trim() || null;
  if (!s('name')) return { ok: false, error: 'Name is required.' };
  const { data, error } = await createClient().from('team_athletes').insert({
    gym_id: ctx.gym.id, name: s('name'), level: s('level'), group_name: s('group_name'),
    hours: s('hours') ? Number(s('hours')) : null, is_new: form.get('is_new') === 'on', backpack_needed: form.get('is_new') === 'on',
    mom_email: s('mom_email'), dad_email: s('dad_email'),
  }).select('id').single();
  if (error) return { ok: false, error: error.message };
  done(slug);
  redirect(`/${slug}/team/${data.id}`);
}

export async function deleteAthlete(slug: string, id: string): Promise<Result> {
  const ctx = await getGymContext(slug);
  if (ctx.role !== 'owner') return { ok: false, error: 'Only managers can remove athletes.' };
  const { error } = await createClient().from('team_athletes').delete().eq('id', id).eq('gym_id', ctx.gym.id);
  if (error) return { ok: false, error: error.message };
  done(slug);
  redirect(`/${slug}/team?tab=roster`);
}

export async function setEntry(slug: string, meetId: string, athleteId: string, on: boolean): Promise<Result> {
  const ctx = await getGymContext(slug);
  const db = createClient();
  const { error } = on
    ? await db.from('team_entries').upsert({ meet_id: meetId, athlete_id: athleteId, gym_id: ctx.gym.id })
    : await db.from('team_entries').delete().eq('meet_id', meetId).eq('athlete_id', athleteId).eq('gym_id', ctx.gym.id);
  if (error) return { ok: false, error: error.message };
  done(slug);
  return { ok: true };
}

export async function saveFee(slug: string, athleteId: string, patch: Partial<Omit<TeamFee, 'athlete_id' | 'gym_id'>>): Promise<Result> {
  const ctx = await getGymContext(slug);
  if (ctx.role !== 'owner') return { ok: false, error: 'Only managers can change fees.' };
  const row: Record<string, unknown> = { athlete_id: athleteId, gym_id: ctx.gym.id };
  for (const k of ['total', 'plan', 'paid_1', 'paid_2', 'paid_3', 'paid_4', 'notes'] as const) if (k in patch) row[k] = clean(patch[k]);
  if ('total' in row) row.total = row.total === null || row.total === '' ? null : Number(row.total);
  const { error } = await createClient().from('team_fees').upsert(row);
  if (error) return { ok: false, error: error.message };
  done(slug);
  return { ok: true };
}

export async function saveMeet(slug: string, id: string | null, m: Omit<TeamMeet, 'id' | 'gym_id'>): Promise<Result> {
  const ctx = await getGymContext(slug);
  if (ctx.role !== 'owner') return { ok: false, error: 'Only managers can edit meets.' };
  const row = {
    gym_id: ctx.gym.id, name: m.name.trim(), start_date: m.start_date || null, end_date: m.end_date || null,
    location: clean(m.location), required: m.required, levels: m.levels, fees: m.fees, team_fee: Number(m.team_fee) || 0, notes: clean(m.notes),
  };
  if (!row.name) return { ok: false, error: 'Meet name is required.' };
  const db = createClient();
  const { error } = id ? await db.from('team_meets').update(row).eq('id', id).eq('gym_id', ctx.gym.id) : await db.from('team_meets').insert(row);
  if (error) return { ok: false, error: error.message };
  done(slug);
  return { ok: true, message: 'Saved.' };
}

export async function deleteMeet(slug: string, id: string): Promise<Result> {
  const ctx = await getGymContext(slug);
  if (ctx.role !== 'owner') return { ok: false, error: 'Only managers can delete meets.' };
  const { error } = await createClient().from('team_meets').delete().eq('id', id).eq('gym_id', ctx.gym.id);
  if (error) return { ok: false, error: error.message };
  done(slug);
  return { ok: true };
}

export async function saveGroup(slug: string, id: string, label: string, practices: Practice[]): Promise<Result> {
  const ctx = await getGymContext(slug);
  if (ctx.role !== 'owner') return { ok: false, error: 'Only managers can edit the schedule.' };
  const { error } = await createClient().from('team_groups')
    .update({ label: label.trim() || null, practices: practices.filter((p) => p.day && p.time) }).eq('id', id).eq('gym_id', ctx.gym.id);
  if (error) return { ok: false, error: error.message };
  done(slug);
  return { ok: true, message: 'Saved.' };
}

export async function saveExpense(slug: string, id: string | null, label: string, amount: number): Promise<Result> {
  const ctx = await getGymContext(slug);
  if (ctx.role !== 'owner') return { ok: false, error: 'Only managers can edit the budget.' };
  const db = createClient();
  const row = { gym_id: ctx.gym.id, label: label.trim() || 'Expense', amount: Number(amount) || 0 };
  const { error } = id ? await db.from('team_expenses').update(row).eq('id', id).eq('gym_id', ctx.gym.id) : await db.from('team_expenses').insert(row);
  if (error) return { ok: false, error: error.message };
  done(slug);
  return { ok: true };
}

export async function deleteExpense(slug: string, id: string): Promise<Result> {
  const ctx = await getGymContext(slug);
  if (ctx.role !== 'owner') return { ok: false, error: 'Only managers can edit the budget.' };
  const { error } = await createClient().from('team_expenses').delete().eq('id', id).eq('gym_id', ctx.gym.id);
  if (error) return { ok: false, error: error.message };
  done(slug);
  return { ok: true };
}

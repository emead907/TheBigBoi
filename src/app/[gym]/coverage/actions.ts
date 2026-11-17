'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getGymContext } from '@/lib/gym';
import { startMinutes, type CoveragePatch } from '@/lib/coverage';

type Result = { ok: true; id?: string } | { ok: false; error: string };

const FIELDS = ['coach', 'status', 'cover'] as const;
const done = (slug: string) => revalidatePath(`/${slug}/coverage`);

export async function updateSlot(slug: string, id: string, raw: CoveragePatch): Promise<Result> {
  const ctx = await getGymContext(slug);
  const patch: Record<string, unknown> = { updated_by: ctx.actor, updated_at: new Date().toISOString() };
  for (const k of FIELDS) if (k in raw) patch[k] = typeof raw[k] === 'string' ? (raw[k] as string).trim() || null : null;
  if (patch.status && patch.status !== 'in' && patch.status !== 'out') return { ok: false, error: 'Bad status.' };
  const { error } = await createClient().from('coverage_slots').update(patch).eq('id', id).eq('gym_id', ctx.gym.id);
  if (error) return { ok: false, error: error.message };
  done(slug);
  return { ok: true };
}

export async function addSlot(slug: string, day: string, name: string, time: string): Promise<Result> {
  const ctx = await getGymContext(slug);
  const n = name.trim();
  if (!n) return { ok: false, error: 'Give it a name.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: 'Bad day.' };
  const kind = /camp/i.test(n) ? 'camp' : /open gym/i.test(n) ? 'opengym' : /team/i.test(n) ? 'team' : 'class';
  const { data, error } = await createClient().from('coverage_slots').insert({
    gym_id: ctx.gym.id, day, kind, name: n, time_label: time.trim() || null, start_min: startMinutes(time), updated_by: ctx.actor,
  }).select('id').single();
  if (error) return { ok: false, error: error.message };
  done(slug);
  return { ok: true, id: data.id };
}

export async function deleteSlot(slug: string, id: string): Promise<Result> {
  const ctx = await getGymContext(slug);
  const { error } = await createClient().from('coverage_slots').delete().eq('id', id).eq('gym_id', ctx.gym.id);
  if (error) return { ok: false, error: error.message };
  done(slug);
  return { ok: true };
}

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getGymContext } from '@/lib/gym';
import type { AccountRow, MemberRow, RegistrationRow } from '@/lib/people';
import { formatPhone } from '@/lib/parse';

export type ImportResult =
  | { ok: true; accounts: { added: number; updated: number }; members: { added: number; updated: number } }
  | { ok: false; error: string };

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export async function importPeople(slug: string, accounts: AccountRow[], members: MemberRow[]): Promise<ImportResult> {
  const ctx = await getGymContext(slug);
  if (ctx.role !== 'owner') return { ok: false, error: 'Only managers can import people.' };
  if (accounts.length > 20000 || members.length > 40000) return { ok: false, error: 'That file is too big to import at once.' };
  const db = createClient();
  const now = new Date().toISOString();

  // Which keys already exist, so we can report added vs. updated.
  const existingKeys = async (table: 'accounts' | 'members') => {
    const keys = new Set<string>();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(table).select('match_key').eq('gym_id', ctx.gym.id).range(from, from + 999);
      if (error) throw new Error(error.message);
      (data ?? []).forEach((r) => keys.add(r.match_key));
      if (!data || data.length < 1000) break;
    }
    return keys;
  };

  try {
    const [haveA, haveM] = await Promise.all([existingKeys('accounts'), existingKeys('members')]);

    const idByKey = new Map<string, string>();
    for (const part of chunk(accounts, 500)) {
      const { data, error } = await db.from('accounts').upsert(
        part.map((a) => ({ ...a, gym_id: ctx.gym.id, imported_at: now })),
        { onConflict: 'gym_id,match_key' },
      ).select('id, match_key');
      if (error) return { ok: false, error: `Families: ${error.message}` };
      (data ?? []).forEach((r) => idByKey.set(r.match_key, r.id));
    }

    const memberRows = members
      .filter((m) => idByKey.has(m.account_key))
      .map(({ account_key: _key, ...m }) => ({ ...m, gym_id: ctx.gym.id, account_id: idByKey.get(_key)!, imported_at: now }));
    for (const part of chunk(memberRows, 500)) {
      const { error } = await db.from('members').upsert(part, { onConflict: 'gym_id,match_key' });
      if (error) return { ok: false, error: `Athletes: ${error.message}` };
    }

    revalidatePath(`/${slug}/people`, 'layout');
    const addedA = accounts.filter((a) => !haveA.has(a.match_key)).length;
    const addedM = memberRows.filter((m) => !haveM.has(m.match_key)).length;
    return {
      ok: true,
      accounts: { added: addedA, updated: accounts.length - addedA },
      members: { added: addedM, updated: memberRows.length - addedM },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateAccount(slug: string, id: string, form: FormData): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getGymContext(slug);
  const s = (k: string) => (form.has(k) ? String(form.get(k) ?? '').trim() || null : undefined);
  const patch: Record<string, unknown> = {};
  for (const k of ['first_name', 'last_name', 'email', 'notes']) { const v = s(k); if (v !== undefined) patch[k] = v; }
  for (const k of ['mobile', 'phone']) { const v = s(k); if (v !== undefined) patch[k] = v ? formatPhone(v) : null; }
  const { error } = await createClient().from('accounts').update(patch).eq('id', id).eq('gym_id', ctx.gym.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/${slug}/people`, 'layout');
  return { ok: true };
}

export async function updateMemberNotes(slug: string, id: string, notes: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getGymContext(slug);
  const { error } = await createClient().from('members').update({ notes: notes.trim() || null }).eq('id', id).eq('gym_id', ctx.gym.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/${slug}/people`, 'layout');
  return { ok: true };
}

export type RegImportResult = { ok: true; total: number; added: number; linked: number; unlinked: string[] } | { ok: false; error: string };

/** Imports GoMotion's New Registrations report and links each row to an athlete in People. */
export async function importRegistrations(slug: string, rows: RegistrationRow[]): Promise<RegImportResult> {
  const ctx = await getGymContext(slug);
  if (ctx.role !== 'owner') return { ok: false, error: 'Only managers can import registrations.' };
  if (rows.length > 20000) return { ok: false, error: 'That file is too big to import at once.' };
  const db = createClient();
  const n = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z]/g, '');

  // Athletes by name + birthday, and by name alone when that name is unique.
  const byNameDob = new Map<string, string>();
  const byName = new Map<string, string | null>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('members').select('id, first_name, last_name, birthday').eq('gym_id', ctx.gym.id).range(from, from + 999);
    if (error) return { ok: false, error: error.message };
    (data ?? []).forEach((m) => {
      const k = `${n(m.first_name)}|${n(m.last_name)}`;
      if (m.birthday) byNameDob.set(`${k}|${m.birthday}`, m.id);
      byName.set(k, byName.has(k) && byName.get(k) !== m.id ? null : m.id);
    });
    if (!data || data.length < 1000) break;
  }

  const have = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from('registrations').select('match_key').eq('gym_id', ctx.gym.id).range(from, from + 999);
    (data ?? []).forEach((r) => have.add(r.match_key));
    if (!data || data.length < 1000) break;
  }

  const unlinked = new Set<string>();
  const payload = rows.map(({ first_name, last_name, ...r }) => {
    const k = `${n(first_name)}|${n(last_name)}`;
    const member_id = (r.birthday && byNameDob.get(`${k}|${r.birthday}`)) || byName.get(k) || null;
    if (!member_id) unlinked.add(r.member_name);
    return { ...r, gym_id: ctx.gym.id, member_id, imported_at: new Date().toISOString() };
  });
  for (let i = 0; i < payload.length; i += 500) {
    const { error } = await db.from('registrations').upsert(payload.slice(i, i + 500), { onConflict: 'gym_id,match_key' });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath(`/${slug}/people`, 'layout');
  return { ok: true, total: rows.length, added: rows.filter((r) => !have.has(r.match_key)).length, linked: payload.filter((p) => p.member_id).length, unlinked: [...unlinked].sort() };
}

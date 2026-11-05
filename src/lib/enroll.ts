import type { SupabaseClient } from '@supabase/supabase-js';
import type { Trial } from './types';

const lc = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
const splitName = (s: string | null | undefined) => {
  const parts = (s ?? '').trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
};
/** "Shining Stars (Girls Beginner)" → "Shining Stars" */
const baseClass = (c: string | null) => (c ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim();

/** Key used to find the family again, matching the GoMotion import (email, else name + phone). */
export function familyKey(t: Pick<Trial, 'parent_email' | 'parent_name' | 'parent_phone'>) {
  return lc(t.parent_email) || `name:${lc(t.parent_name)}|${(t.parent_phone ?? '').replace(/\D/g, '')}`;
}

/**
 * When a request is marked enrolled, make sure the family and athlete are in People
 * and the class shows on the athlete. Finds existing records first so nothing is duplicated.
 * Uses the admin client (registrations are manager-only), always scoped to this gym.
 */
export async function addEnrolledToPeople(db: SupabaseClient, gymId: string, t: Trial, today: string) {
  const akey = familyKey(t);
  const parent = splitName(t.parent_name);
  const child = splitName(t.child_name);
  const childLast = child.last || parent.last;
  const created: string[] = [];

  // Family
  let { data: acct } = await db.from('accounts').select('id, first_name, last_name').eq('gym_id', gymId).eq('match_key', akey).maybeSingle();
  if (!acct && t.parent_email) {
    ({ data: acct } = await db.from('accounts').select('id, first_name, last_name').eq('gym_id', gymId).ilike('email', t.parent_email.trim()).limit(1).maybeSingle());
  }
  if (!acct) {
    const { data, error } = await db.from('accounts').insert({
      gym_id: gymId, match_key: akey, first_name: parent.first || null, last_name: parent.last || null,
      email: t.parent_email ? lc(t.parent_email) : null, mobile: t.parent_phone, status: 'active', source: 'hub',
    }).select('id, first_name, last_name').single();
    if (error) throw new Error(`Couldn't add the family to People: ${error.message}`);
    acct = data; created.push('family');
  }

  // Athlete (same first name on the account counts as the same kid)
  const { data: kids } = await db.from('members').select('id, first_name, last_name, birthday').eq('account_id', acct!.id);
  let kid = (kids ?? []).find((m) => lc(m.first_name) === lc(child.first) && (!child.last || !m.last_name || lc(m.last_name) === lc(child.last)));
  if (!kid) {
    const { data, error } = await db.from('members').insert({
      gym_id: gymId, account_id: acct!.id, first_name: child.first || t.child_name, last_name: childLast || null,
      birthday: t.birthday, match_key: `${akey}|${lc(`${child.first} ${childLast}`)}|${t.birthday ?? ''}`, status: 'active',
    }).select('id, first_name, last_name, birthday').single();
    if (error) throw new Error(`Couldn't add ${t.child_name} to People: ${error.message}`);
    kid = data!; created.push('athlete');
  }

  // Class (replaced by the real one on the next GoMotion registrations import)
  const cls = baseClass(t.class_name);
  if (cls) {
    const { error } = await db.from('registrations').upsert({
      gym_id: gymId, member_id: kid.id, match_key: `hub:trial:${t.id}`,
      member_name: `${kid.first_name} ${kid.last_name ?? ''}`.trim(), birthday: kid.birthday ?? t.birthday,
      account_name: t.parent_name, phone: t.parent_phone, class_name: cls, slot: t.requested_time,
      registered_on: today, start_date: t.first_day ?? today, waitlisted: false,
    }, { onConflict: 'gym_id,match_key' });
    if (error) throw new Error(`Couldn't add the class in People: ${error.message}`);
  }
  return { accountId: acct!.id as string, created };
}

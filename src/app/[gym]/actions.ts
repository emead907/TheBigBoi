'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getGymContext } from '@/lib/gym';
import { formatDay } from '@/lib/dates';
import { formatPhone, parseDateLoose } from '@/lib/parse';
import { checkOverride, sendTemplate, trialSendOptions, type MessageOverride } from '@/lib/messaging';
import type { SendOption } from '@/components/SendPanel';
import { statusText } from '@/lib/stages';
import { addEnrolledToPeople } from '@/lib/enroll';
import type { Channel, Template, TemplateKey, Trial, TrialStatus } from '@/lib/types';

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const EDITABLE = [
  'child_name', 'birthday', 'class_name', 'requested_time', 'parent_name', 'parent_email', 'parent_phone',
  'zip', 'sms_opt_in', 'in_sportsengine', 'spot_email_sent_at', 'called_at', 'first_day', 'first_day_time',
  'showed_up', 'status', 'enroll_plan', 'followed_up_at', 'notes', 'waitlisted_at', 'offered_at',
] as const;
type Editable = (typeof EDITABLE)[number];
export type TrialPatch = Partial<Pick<Trial, Editable>>;

function describe(patch: TrialPatch): string[] {
  const out: string[] = [];
  const has = (k: Editable) => Object.prototype.hasOwnProperty.call(patch, k);
  if (has('in_sportsengine')) out.push(patch.in_sportsengine ? 'Marked as added (SportsEngine / Jackrabbit)' : 'Unchecked added to SportsEngine / Jackrabbit');
  if (has('spot_email_sent_at')) out.push(patch.spot_email_sent_at ? 'Marked spot email sent' : 'Unchecked spot email');
  if (has('called_at')) out.push(patch.called_at ? 'Marked called' : 'Unchecked called');
  if (has('first_day')) out.push(patch.first_day ? `First day set to ${formatDay(patch.first_day)}` : 'First day cleared');
  if (has('first_day_time') && !has('first_day')) out.push(patch.first_day_time ? `First-day time set to ${patch.first_day_time}` : 'First-day time cleared');
  if (has('showed_up')) out.push(patch.showed_up === true ? 'Showed up' : patch.showed_up === false ? 'Did not show up' : 'Attendance cleared');
  if (has('status')) out.push(`Status: ${statusText({ status: patch.status as TrialStatus, enroll_plan: patch.enroll_plan ?? null })}`);
  if (has('followed_up_at')) out.push(patch.followed_up_at ? 'Marked followed up' : 'Unchecked followed up');
  if (has('sms_opt_in')) out.push(patch.sms_opt_in ? 'Family agreed to texts' : 'Texts turned off');
  if (has('waitlisted_at')) out.push(patch.waitlisted_at ? 'Added to the waitlist' : 'Removed from the waitlist');
  if (has('offered_at') && patch.offered_at) out.push('Spot offered from the waitlist');
  if (has('notes')) out.push('Updated notes');
  const info = (['child_name', 'birthday', 'class_name', 'requested_time', 'parent_name', 'parent_email', 'parent_phone', 'zip'] as Editable[]).filter(has);
  if (info.length) out.push('Updated family details');
  return out;
}

export async function updateTrial(slug: string, id: string, raw: TrialPatch): Promise<ActionResult> {
  const ctx = await getGymContext(slug);
  const supabase = createClient();
  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in raw) patch[k] = (raw as Record<string, unknown>)[k];
  if ('parent_phone' in patch && typeof patch.parent_phone === 'string') patch.parent_phone = formatPhone(patch.parent_phone);
  for (const k of ['birthday', 'first_day']) if (patch[k] === '') patch[k] = null;
  if ('status' in patch) patch.closed_at = patch.status === 'open' ? null : new Date().toISOString();
  // A new first day means a new reminder should go out.
  if ('first_day' in patch) patch.reminder_sent_at = null;
  patch.updated_by = ctx.userId;

  const { error } = await supabase.from('trials').update(patch).eq('id', id).eq('gym_id', ctx.gym.id);
  if (error) return { ok: false, error: error.message };

  const lines = describe(raw);
  let note = '';
  if (patch.status === 'enrolled') {
    try {
      const { data: t } = await supabase.from('trials').select('*').eq('id', id).single();
      if (t) {
        const r = await addEnrolledToPeople(createAdminClient(), ctx.gym.id, t as Trial, ctx.today);
        lines.push(r.created.length ? `Added to People (new ${r.created.join(' and ')})` : 'Class added in People');
      }
    } catch (e) {
      note = e instanceof Error ? e.message : String(e);
    }
  }
  if (lines.length) {
    await supabase.from('activity').insert(lines.map((detail) => ({
      gym_id: ctx.gym.id, trial_id: id, user_id: ctx.userId, actor: ctx.actor, kind: 'update', detail,
    })));
  }
  revalidatePath(`/${slug}`, 'layout');
  return note ? { ok: false, error: `Marked enrolled, but ${note[0].toLowerCase()}${note.slice(1)}` } : { ok: true };
}

/** Message previews for one request, so the board can send without opening the full page. */
export async function getTrialSendOptions(slug: string, id: string): Promise<{ ok: true; options: SendOption[] } | { ok: false; error: string }> {
  const ctx = await getGymContext(slug);
  const supabase = createClient();
  const [{ data: trial }, { data: tpls }] = await Promise.all([
    supabase.from('trials').select('*').eq('id', id).eq('gym_id', ctx.gym.id).single(),
    supabase.from('templates').select('*').eq('gym_id', ctx.gym.id),
  ]);
  if (!trial) return { ok: false, error: 'Request not found.' };
  return { ok: true, options: trialSendOptions((tpls ?? []) as Template[], trial as Trial, ctx.gym) };
}

export async function sendTrialMessage(slug: string, id: string, key: TemplateKey, channel: Channel, override?: MessageOverride): Promise<ActionResult> {
  const ctx = await getGymContext(slug);
  const bad = checkOverride(override);
  if (bad) return { ok: false, error: bad };
  const supabase = createClient();
  const [{ data: trial }, { data: template }] = await Promise.all([
    supabase.from('trials').select('*').eq('id', id).eq('gym_id', ctx.gym.id).single(),
    supabase.from('templates').select('*').eq('gym_id', ctx.gym.id).eq('key', key).eq('channel', channel).single(),
  ]);
  if (!trial) return { ok: false, error: 'Request not found.' };
  if (!template) return { ok: false, error: 'That message template is missing. Add it in Settings.' };

  const res = await sendTemplate({
    db: supabase, gym: ctx.gym, trial: trial as Trial, template: template as Template, sentBy: ctx.userId, actor: ctx.actor, override,
  });
  revalidatePath(`/${slug}`, 'layout');
  return res.ok ? { ok: true, message: channel === 'email' ? 'Email sent.' : 'Text sent.' } : { ok: false, error: res.error ?? 'Not sent.' };
}

export async function createTrials(slug: string, form: FormData): Promise<ActionResult> {
  const ctx = await getGymContext(slug);
  const supabase = createClient();
  const s = (k: string) => String(form.get(k) ?? '').trim();
  const names = form.getAll('child_name').map((v) => String(v).trim());
  const birthdays = form.getAll('birthday').map((v) => String(v).trim());
  const firstDays = form.getAll('first_day').map((v) => String(v).trim());

  const rows = names
    .map((child_name, i) => ({
      gym_id: ctx.gym.id,
      source: (s('source') || 'manual') as Trial['source'],
      child_name,
      birthday: parseDateLoose(birthdays[i] ?? '') ,
      first_day: firstDays[i] || null,
      class_name: s('class_name') || null,
      requested_time: s('requested_time') || null,
      parent_name: s('parent_name') || null,
      parent_email: s('parent_email') || null,
      parent_phone: s('parent_phone') ? formatPhone(s('parent_phone')) : null,
      zip: s('zip') || null,
      sms_opt_in: form.get('sms_opt_in') === 'on',
      notes: s('notes') || null,
      waitlisted_at: form.get('waitlist') === 'on' ? new Date().toISOString() : null,
      updated_by: ctx.userId,
    }))
    .filter((r) => r.child_name);
  if (rows.length === 0) return { ok: false, error: 'Add at least one child.' };

  const { data, error } = await supabase.from('trials').insert(rows).select('id, child_name');
  if (error) return { ok: false, error: error.message };
  await supabase.from('activity').insert((data ?? []).map((t) => ({
    gym_id: ctx.gym.id, trial_id: t.id, user_id: ctx.userId, actor: ctx.actor, kind: 'created',
    detail: `Request added (${rows[0].source.replace('_', '-')})`,
  })));
  revalidatePath(`/${slug}`, 'layout');
  if (data && data.length === 1) redirect(`/${slug}/trials/${data[0].id}`);
  redirect(`/${slug}`);
}

/** Permanently removes a request (tests, out-of-area leads). It drops out of every report. */
export async function deleteTrial(slug: string, id: string, opts: { stay?: boolean } = {}): Promise<ActionResult> {
  const ctx = await getGymContext(slug);
  if (ctx.role !== 'owner') return { ok: false, error: 'Only managers can delete requests.' };
  const { error } = await createClient().from('trials').delete().eq('id', id).eq('gym_id', ctx.gym.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/${slug}`, 'layout');
  if (opts.stay) return { ok: true, message: 'Deleted.' };
  redirect(`/${slug}`);
}

/* ───────────── Settings (owners) ───────────── */

export async function saveTemplate(slug: string, key: TemplateKey, channel: Channel, form: FormData): Promise<ActionResult> {
  const ctx = await getGymContext(slug);
  if (ctx.role !== 'owner') return { ok: false, error: 'Only managers can edit messages.' };
  const { error } = await createClient().from('templates').upsert({
    gym_id: ctx.gym.id, key, channel,
    subject: channel === 'email' ? String(form.get('subject') ?? '') : null,
    body: String(form.get('body') ?? ''),
    auto_send: form.get('auto_send') === 'on',
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/${slug}/settings`);
  return { ok: true, message: 'Saved.' };
}

export async function saveGym(slug: string, form: FormData): Promise<ActionResult> {
  const ctx = await getGymContext(slug);
  if (ctx.role !== 'owner') return { ok: false, error: 'Only managers can change gym settings.' };
  const s = (k: string) => String(form.get(k) ?? '').trim() || null;
  const { error } = await createClient().from('gyms').update({
    name: s('name') ?? ctx.gym.name, short_name: s('short_name') ?? ctx.gym.short_name,
    phone: s('phone'), email: s('email'), from_email: s('from_email'), sms_from: s('sms_from'),
    address: s('address'), website: s('website'), waiver_url: s('waiver_url'), jackrabbit_org_id: s('jackrabbit_org_id'), jackrabbit_location: s('jackrabbit_location'), team_label: s('team_label') ?? 'Team', location_label: s('location_label'),
    ...(/^#[0-9a-f]{6}$/i.test(s('brand_color') ?? '') ? { brand_color: s('brand_color') } : {}),
    ...(/^#[0-9a-f]{6}$/i.test(s('accent_color') ?? '') ? { accent_color: s('accent_color') } : {}),
  }).eq('id', ctx.gym.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/${slug}`, 'layout');
  return { ok: true, message: 'Saved.' };
}

export async function rotateIntakeKey(slug: string): Promise<ActionResult> {
  const ctx = await getGymContext(slug);
  if (ctx.role !== 'owner') return { ok: false, error: 'Only managers can do this.' };
  const key = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, '0')).join('');
  const { error } = await createClient().from('gyms').update({ intake_key: key }).eq('id', ctx.gym.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/${slug}/settings`);
  return { ok: true, message: 'New key made. Update your website with it.' };
}

export async function inviteStaff(slug: string, form: FormData): Promise<ActionResult> {
  const ctx = await getGymContext(slug);
  if (ctx.role !== 'owner') return { ok: false, error: 'Only managers can invite staff.' };
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const name = String(form.get('display_name') ?? '').trim() || null;
  const role = form.get('role') === 'owner' ? 'owner' : 'staff';
  const gymIds = form.getAll('gym_ids').map(String).filter((id) => ctx.gyms.some((g) => g.id === id));
  if (!email) return { ok: false, error: 'Enter an email address.' };
  if (gymIds.length === 0) gymIds.push(ctx.gym.id);

  const admin = createAdminClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  let userId: string | null = null;
  const invited = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${origin}/auth/callback?next=/set-password` });
  if (invited.data.user) userId = invited.data.user.id;
  else {
    // Already has an account (for example, works at the other gym).
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
  }
  if (!userId) return { ok: false, error: invited.error?.message ?? 'Could not invite that email.' };

  const { error } = await admin.from('memberships').upsert(
    gymIds.map((gym_id) => ({ gym_id, user_id: userId, role, display_name: name })),
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/${slug}/settings`);
  return { ok: true, message: invited.data.user ? `Invite sent to ${email}.` : `${email} added.` };
}

export async function removeStaff(slug: string, userId: string): Promise<ActionResult> {
  const ctx = await getGymContext(slug);
  if (ctx.role !== 'owner') return { ok: false, error: 'Only managers can remove staff.' };
  if (userId === ctx.userId) return { ok: false, error: "You can't remove yourself." };
  const { error } = await createAdminClient().from('memberships').delete().eq('gym_id', ctx.gym.id).eq('user_id', userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/${slug}/settings`);
  return { ok: true, message: 'Removed.' };
}

/**
 * "Add to Jackrabbit": sends this family to Zapier, which creates the family,
 * parent contact and student in Jackrabbit, then reports back to /api/jackrabbit/added.
 * Nampa hub only for now.
 */
export async function addToJackrabbit(slug: string, id: string): Promise<ActionResult> {
  const { jackrabbitSyncOn, splitName } = await import('@/lib/jackrabbit-sync');
  const ctx = await getGymContext(slug);
  if (!jackrabbitSyncOn(ctx.gym.slug)) return { ok: false, error: 'Adding to Jackrabbit isn’t turned on for this hub yet.' };
  const hook = process.env.JACKRABBIT_ADD_HOOK_URL;
  if (!hook) return { ok: false, error: 'JACKRABBIT_ADD_HOOK_URL isn’t set in Vercel yet.' };

  const supabase = createClient();
  const { data: t } = await supabase.from('trials').select('*').eq('id', id).eq('gym_id', ctx.gym.id).maybeSingle();
  if (!t) return { ok: false, error: 'Request not found.' };
  const trial = t as Trial;
  const parent = splitName(trial.parent_name);
  const child = splitName(trial.child_name);
  if (!parent.last) return { ok: false, error: 'Add the parent’s first and last name first (Edit on Family information).' };
  if (!trial.parent_email || !trial.parent_phone) return { ok: false, error: 'Add the parent’s email and phone first.' };
  if (!trial.birthday) return { ok: false, error: 'Add the child’s birthday first. Jackrabbit needs it for the student.' };

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
  try {
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gym: ctx.gym.slug, trial_id: trial.id, location: ctx.gym.jackrabbit_location ?? '',
        callback_url: `${site}/api/jackrabbit/added`, callback_key: ctx.gym.intake_key,
        parent_first: parent.first, parent_last: parent.last, email: trial.parent_email, phone: trial.parent_phone, zip: trial.zip ?? '',
        child_first: child.first || trial.child_name, child_last: child.last || parent.last, birthday: trial.birthday,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, error: `Zapier answered ${res.status}.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  await supabase.from('activity').insert({ gym_id: ctx.gym.id, trial_id: id, user_id: ctx.userId, actor: ctx.actor, kind: 'update', detail: 'Sent to Jackrabbit' });
  revalidatePath(`/${slug}/trials/${id}`);
  return { ok: true, message: 'Sent to Jackrabbit. Refresh in a minute to see the family ID.' };
}

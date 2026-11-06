import 'server-only';
import { Resend } from 'resend';
import twilio from 'twilio';
import { TRIAL_KEYS, type Channel, type Gym, type Template, type TemplateKey, type Trial } from './types';
import { emailHtml, partyVars, plainLinks, renderTemplate, templateVars } from './templates';
import type { Party } from './parties';
import { toE164 } from './parse';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SendResult {
  ok: boolean;
  status: 'sent' | 'failed' | 'not_configured';
  error?: string;
}

export function channelReady(channel: Channel, gym: Gym): string | null {
  if (channel === 'email') {
    if (!process.env.RESEND_API_KEY) return 'Email is not set up yet (add RESEND_API_KEY in Vercel).';
    if (!gym.from_email) return 'Add a "send from" address in Settings.';
  } else {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return 'Texting is not set up yet (add the Twilio keys in Vercel).';
    if (!gym.sms_from) return 'Add the gym\'s Twilio number in Settings.';
  }
  return null;
}

export function recipientProblem(channel: Channel, trial: Trial): string | null {
  if (channel === 'email') return trial.parent_email ? null : 'No parent email on file.';
  if (!toE164(trial.parent_phone)) return 'No valid mobile number on file.';
  if (!trial.sms_opt_in) return 'This family has not agreed to texts.';
  return null;
}

/** Sends one message through Resend or Twilio. */
async function deliver(gym: Gym, channel: Channel, to: string, subject: string | null, body: string, blocked: string | null) {
  let providerId: string | null = null;
  if (blocked) return { result: { ok: false, status: blocked.includes('not set up') ? 'not_configured' : 'failed', error: blocked } as SendResult, providerId };
  try {
    if (channel === 'email') {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { data, error } = await resend.emails.send({
        from: gym.from_email!, to, replyTo: gym.email ?? undefined,
        subject: subject ?? gym.name, text: plainLinks(body), html: emailHtml(body, gym),
      });
      if (error) throw new Error(error.message);
      providerId = data?.id ?? null;
    } else {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const msg = await client.messages.create({ from: gym.sms_from!, to, body: plainLinks(body) });
      providerId = msg.sid;
    }
    return { result: { ok: true, status: 'sent' } as SendResult, providerId };
  } catch (err) {
    return { result: { ok: false, status: 'failed', error: err instanceof Error ? err.message : String(err) } as SendResult, providerId };
  }
}

async function record(db: SupabaseClient, opts: {
  gym: Gym; template: Template; to: string; subject: string | null; body: string; result: SendResult; providerId: string | null;
  sentBy?: string | null; actor: string; trialId?: string; partyId?: string;
}) {
  const { gym, template, to, subject, body, result, providerId, sentBy, actor, trialId, partyId } = opts;
  await db.from('messages').insert({
    gym_id: gym.id, trial_id: trialId ?? null, party_id: partyId ?? null, channel: template.channel, template_key: template.key,
    to_address: to || '(none)', subject, body, status: result.status, provider_id: providerId,
    error: result.error ?? null, sent_by: sentBy ?? null,
  });
  const label = TEMPLATE_LABEL[template.key];
  const what = template.channel === 'email' ? 'email' : 'text';
  await db.from('activity').insert({
    gym_id: gym.id, trial_id: trialId ?? null, party_id: partyId ?? null, user_id: sentBy ?? null, actor,
    kind: result.ok ? 'message_sent' : 'message_failed',
    detail: result.ok ? `${label} ${what} sent to ${to}` : `${label} ${what} not sent: ${result.error}`,
  });
}

/**
 * Renders a template for a trial, sends it, and records it in `messages` + `activity`.
 * `db` is the signed-in client (manual sends) or the admin client (nightly job).
 */
/** Wording a staff member edited in the send panel, used instead of the template's for this one message. */
export type MessageOverride = { subject?: string | null; body: string };

export async function sendTemplate(opts: {
  db: SupabaseClient; gym: Gym; trial: Trial; template: Template; sentBy?: string | null; actor: string; override?: MessageOverride;
}): Promise<SendResult> {
  const { db, gym, trial, template, override } = opts;
  const vars = templateVars(trial, gym);
  const body = renderTemplate(override?.body ?? template.body, vars);
  const subjectSrc = override && override.subject !== undefined ? override.subject : template.subject;
  const subject = subjectSrc ? renderTemplate(subjectSrc, vars) : null;
  const to = template.channel === 'email' ? trial.parent_email ?? '' : toE164(trial.parent_phone) ?? '';
  const { result, providerId } = await deliver(gym, template.channel, to, subject, body,
    channelReady(template.channel, gym) ?? recipientProblem(template.channel, trial));
  await record(db, { ...opts, to, subject, body, result, providerId, trialId: trial.id });

  if (result.ok) {
    const now = new Date().toISOString();
    const patch: Partial<Trial> =
      template.key === 'spot_ready' ? { spot_email_sent_at: trial.spot_email_sent_at ?? now }
      : template.key === 'first_day_confirm' ? { confirm_sent_at: now }
      : template.key === 'first_day_reminder' ? { reminder_sent_at: now }
      : template.key === 'follow_up_2' ? { followup2_sent_at: now }
      : { followup_sent_at: now, followed_up_at: trial.followed_up_at ?? now };
    await db.from('trials').update(patch).eq('id', trial.id);
  }
  return result;
}

export function partyRecipientProblem(channel: Channel, party: Party): string | null {
  if (channel === 'email') return party.parent_email ? null : 'No parent email on file.';
  return 'Party messages go by email only.';
}

/** Same as sendTemplate, for a birthday party. */
export async function sendPartyTemplate(opts: {
  db: SupabaseClient; gym: Gym; party: Party; template: Template; sentBy?: string | null; actor: string; override?: MessageOverride;
}): Promise<SendResult> {
  const { db, gym, party, template, override } = opts;
  const vars = partyVars(party, gym);
  const body = renderTemplate(override?.body ?? template.body, vars);
  const subjectSrc = override && override.subject !== undefined ? override.subject : template.subject;
  const subject = subjectSrc ? renderTemplate(subjectSrc, vars) : null;
  const to = party.parent_email ?? '';
  const { result, providerId } = await deliver(gym, template.channel, to, subject, body,
    channelReady(template.channel, gym) ?? partyRecipientProblem(template.channel, party));
  await record(db, { ...opts, to, subject, body, result, providerId, partyId: party.id });

  if (result.ok) {
    const now = new Date().toISOString();
    const patch: Partial<Party> =
      template.key === 'party_inquiry' ? { contacted_at: party.contacted_at ?? now }
      : template.key === 'party_confirmation' ? { confirmed_at: party.confirmed_at ?? now }
      : template.key === 'party_reminder' ? { reminder_sent_at: now }
      : { thanks_sent_at: now };
    await db.from('parties').update(patch).eq('id', party.id);
  }
  return result;
}

/** Rendered previews of a trial's message templates, for the send panel. */
export function trialSendOptions(templates: Template[], trial: Trial, gym: Gym) {
  const vars = templateVars(trial, gym);
  const order: string[] = TRIAL_KEYS;
  return templates
    .filter((t) => order.includes(t.key))
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key) || a.channel.localeCompare(b.channel))
    .map((t) => ({
      key: t.key, channel: t.channel, label: TEMPLATE_LABEL[t.key],
      subject: t.subject ? renderTemplate(t.subject, vars) : null,
      body: renderTemplate(t.body, vars),
      blocked: channelReady(t.channel, gym) ?? recipientProblem(t.channel, trial),
    }));
}

/** Basic limits on edited wording. Returns a problem to show, or null. */
export function checkOverride(o?: MessageOverride): string | null {
  if (!o) return null;
  if (typeof o.body !== 'string' || !o.body.trim()) return 'The message is empty.';
  if (o.body.length > 10000) return 'The message is too long.';
  if (o.subject != null && (typeof o.subject !== 'string' || o.subject.length > 200)) return 'The subject is too long.';
  return null;
}

export const TEMPLATE_LABEL: Record<TemplateKey, string> = {
  spot_ready: 'Spot is ready',
  first_day_confirm: 'First-day confirmation',
  first_day_reminder: 'First-day reminder',
  follow_up: 'Follow-up',
  follow_up_2: 'Follow-up 2 (No-Risk policy)',
  party_inquiry: 'Party inquiry reply',
  party_confirmation: 'Party confirmation',
  party_reminder: 'Party reminder',
  party_thank_you: 'Party thank-you',
};

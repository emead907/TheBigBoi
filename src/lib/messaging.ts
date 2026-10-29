import 'server-only';
import { Resend } from 'resend';
import twilio from 'twilio';
import type { Channel, Gym, Template, TemplateKey, Trial } from './types';
import { emailHtml, renderTemplate, templateVars } from './templates';
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

/**
 * Renders a template for a trial, sends it, and records it in `messages` + `activity`.
 * `db` is the signed-in client (manual sends) or the admin client (nightly job).
 */
export async function sendTemplate(opts: {
  db: SupabaseClient;
  gym: Gym;
  trial: Trial;
  template: Template;
  sentBy?: string | null;
  actor: string;
}): Promise<SendResult> {
  const { db, gym, trial, template, sentBy, actor } = opts;
  const vars = templateVars(trial, gym);
  const body = renderTemplate(template.body, vars);
  const subject = template.subject ? renderTemplate(template.subject, vars) : null;
  const to = template.channel === 'email' ? trial.parent_email ?? '' : toE164(trial.parent_phone) ?? '';

  let result: SendResult;
  let providerId: string | null = null;
  const blocked = channelReady(template.channel, gym) ?? recipientProblem(template.channel, trial);

  if (blocked) {
    result = { ok: false, status: blocked.includes('not set up') ? 'not_configured' : 'failed', error: blocked };
  } else {
    try {
      if (template.channel === 'email') {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { data, error } = await resend.emails.send({
          from: gym.from_email!,
          to,
          replyTo: gym.email ?? undefined,
          subject: subject ?? gym.name,
          text: body,
          html: emailHtml(body, gym),
        });
        if (error) throw new Error(error.message);
        providerId = data?.id ?? null;
      } else {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        const msg = await client.messages.create({ from: gym.sms_from!, to, body });
        providerId = msg.sid;
      }
      result = { ok: true, status: 'sent' };
    } catch (err) {
      result = { ok: false, status: 'failed', error: err instanceof Error ? err.message : String(err) };
    }
  }

  await db.from('messages').insert({
    gym_id: gym.id, trial_id: trial.id, channel: template.channel, template_key: template.key,
    to_address: to || '(none)', subject, body, status: result.status, provider_id: providerId,
    error: result.error ?? null, sent_by: sentBy ?? null,
  });

  const label = TEMPLATE_LABEL[template.key];
  await db.from('activity').insert({
    gym_id: gym.id, trial_id: trial.id, user_id: sentBy ?? null, actor,
    kind: result.ok ? 'message_sent' : 'message_failed',
    detail: result.ok
      ? `${label} ${template.channel === 'email' ? 'email' : 'text'} sent to ${to}`
      : `${label} ${template.channel === 'email' ? 'email' : 'text'} not sent: ${result.error}`,
  });

  if (result.ok) {
    const now = new Date().toISOString();
    const patch: Partial<Trial> =
      template.key === 'spot_ready' ? { spot_email_sent_at: trial.spot_email_sent_at ?? now }
      : template.key === 'first_day_reminder' ? { reminder_sent_at: now }
      : { followup_sent_at: now, followed_up_at: trial.followed_up_at ?? now };
    await db.from('trials').update(patch).eq('id', trial.id);
  }
  return result;
}

export const TEMPLATE_LABEL: Record<TemplateKey, string> = {
  spot_ready: 'Spot is ready',
  first_day_reminder: 'First-day reminder',
  follow_up: 'Follow-up',
};

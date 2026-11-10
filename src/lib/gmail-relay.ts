import 'server-only';

/**
 * Some hubs send email through their own Gmail instead of Resend: the hub
 * posts each email to a Zapier workflow ("Hub email via Gmail",
 * GMAIL_RELAY_HOOK_URL), which sends it from that gym's connected Gmail.
 * No domain setup needed, and replies land in that Gmail inbox.
 * For now only the Nampa hub does this.
 */
export const GMAIL_RELAY_HUBS = new Set(['gym-nest']);
export const gmailRelayOn = (slug: string) => GMAIL_RELAY_HUBS.has(slug);

export async function sendViaGmail(opts: { gym: string; fromName: string; replyTo: string | null; to: string; subject: string; html: string; text: string }): Promise<string> {
  const hook = process.env.GMAIL_RELAY_HOOK_URL;
  if (!hook) throw new Error('Email is not set up yet (add GMAIL_RELAY_HOOK_URL in Vercel).');
  const res = await fetch(hook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gym: opts.gym, from_name: opts.fromName, reply_to: opts.replyTo ?? '', to: opts.to, subject: opts.subject, html: opts.html, text: opts.text }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Gmail relay answered ${res.status}.`);
  const data = (await res.json().catch(() => null)) as { request_id?: string; id?: string } | null;
  return data?.request_id ?? data?.id ?? 'gmail-relay';
}

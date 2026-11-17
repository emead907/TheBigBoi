import 'server-only';

/**
 * Some hubs text through RingCentral instead of Twilio, so families get texts
 * from the gym's real RingCentral number and replies land in the RingCentral app.
 * For now only the Gym Stars hub does this.
 *
 * Vercel env vars (from a RingCentral "REST API App" using JWT auth, with the SMS permission):
 *   RINGCENTRAL_CLIENT_ID, RINGCENTRAL_CLIENT_SECRET, RINGCENTRAL_JWT
 *   RINGCENTRAL_SERVER (optional, defaults to https://platform.ringcentral.com)
 * The "from" number is the gym's texting number in Settings; it must be an
 * SMS-enabled number on the RingCentral user the JWT belongs to.
 */
export const RINGCENTRAL_HUBS = new Set(['gym-stars']);
export const ringCentralOn = (slug: string) => RINGCENTRAL_HUBS.has(slug);

export function ringCentralMissing(): string | null {
  const missing = ['RINGCENTRAL_CLIENT_ID', 'RINGCENTRAL_CLIENT_SECRET', 'RINGCENTRAL_JWT'].filter((k) => !process.env[k]);
  return missing.length ? `Texting is not set up yet (add ${missing.join(', ')} in Vercel).` : null;
}

const server = () => (process.env.RINGCENTRAL_SERVER || 'https://platform.ringcentral.com').replace(/\/$/, '');

let cached: { token: string; expires: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const basic = Buffer.from(`${process.env.RINGCENTRAL_CLIENT_ID}:${process.env.RINGCENTRAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${server()}/restapi/oauth/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: process.env.RINGCENTRAL_JWT! }),
    signal: AbortSignal.timeout(8000),
  });
  const data = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number; error_description?: string; message?: string } | null;
  if (!res.ok || !data?.access_token) throw new Error(`RingCentral sign-in failed: ${data?.error_description || data?.message || res.status}`);
  cached = { token: data.access_token, expires: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cached.token;
}

/** Sends one SMS from `from` (E.164) to `to` (E.164). Returns RingCentral's message id. */
export async function sendViaRingCentral(opts: { from: string; to: string; text: string }): Promise<string> {
  const token = await accessToken();
  const res = await fetch(`${server()}/restapi/v1.0/account/~/extension/~/sms`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: { phoneNumber: opts.from }, to: [{ phoneNumber: opts.to }], text: opts.text }),
    signal: AbortSignal.timeout(10000),
  });
  const data = (await res.json().catch(() => null)) as { id?: number | string; message?: string; errors?: { message?: string }[] } | null;
  if (res.status === 401) cached = null;
  if (!res.ok) throw new Error(`RingCentral: ${data?.errors?.[0]?.message || data?.message || `answered ${res.status}`}`);
  return String(data?.id ?? 'ringcentral');
}

import type { Gym, Trial } from './types';
import type { Party } from './parties';
import { formatDay } from './dates';

const first = (s: string | null | undefined, fallback: string) => (s ?? '').trim().split(/\s+/)[0] || fallback;

export function templateVars(t: Trial, gym: Pick<Gym, 'name' | 'short_name' | 'phone'> & { website?: string | null }): Record<string, string> {
  return {
    parent_first: first(t.parent_name, 'there'),
    child_first: first(t.child_name, 'your child'),
    class: t.class_name || 'class',
    requested_time: t.requested_time || 'requested time',
    first_day: t.first_day ? formatDay(t.first_day) : '',
    first_day_time: t.first_day_time ? ` at ${t.first_day_time}` : '',
    gym_name: gym.short_name || gym.name,
    gym_phone: gym.phone || '',
    portal_link: siteLink(gym, '/parent-portal'),
  };
}

type GymBits = Pick<Gym, 'name' | 'short_name' | 'phone'> & { website?: string | null };

function siteLink(gym: GymBits, path: string) {
  const base = (gym.website ?? '').trim().replace(/\/+$/, '');
  if (!base) return '';
  return (/^https?:\/\//.test(base) ? base : `https://${base}`) + path;
}

/** "2026-11-07" → "Saturday, November 7" */
export function longDay(ymd: string | null | undefined): string {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' });
}

const dollars = (n: number | null | undefined) =>
  n == null ? '' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export function partyVars(p: Party, gym: GymBits): Record<string, string> {
  const balance = Math.max(0, (p.total_price ?? 0) - (p.amount_paid ?? 0));
  return {
    parent_first: first(p.parent_name, 'there'),
    child_first: first(p.child_name, 'your child'),
    child_age: p.child_age ?? '',
    party_date: longDay(p.party_date) || 'your requested date',
    time_slot: p.time_slot || 'your requested time',
    num_children: p.num_children != null ? String(p.num_children) : 'TBD',
    price: dollars(p.total_price),
    amount_paid: dollars(p.amount_paid ?? 0),
    balance: dollars(balance),
    gym_name: gym.short_name || gym.name,
    gym_phone: gym.phone || '',
    waiver_link: siteLink(gym, '/waiver'),
  };
}

export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => (k in vars ? vars[k] : ''))
    .replace(/\(\s*\)/g, '') // drop "()" when an optional value was empty
    .replace(/[ \t]+\n/g, '\n');
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Simple branded HTML version of a plain-text email body. */
export function emailHtml(body: string, gym: Pick<Gym, 'name' | 'phone' | 'address' | 'brand_color'>): string {
  const blocks = body.trim().split(/\n{2,}/).map((block) => {
    const lines = block.split('\n');
    const heading = /^[A-Z0-9 '&-]{4,}$/.test(lines[0].trim()) ? lines.shift()!.trim() : null;
    const isList = lines.length > 0 && lines.every((l) => /^\s*[-•]\s+/.test(l));
    const inner = isList
      ? `<ul style="margin:0;padding-left:20px;">${lines.map((l) => `<li style="margin:0 0 4px;">${esc(l.replace(/^\s*[-•]\s+/, ''))}</li>`).join('')}</ul>`
      : `<p style="margin:0;">${lines.map(esc).join('<br>')}</p>`;
    return `${heading ? `<div style="font-size:12px;font-weight:bold;letter-spacing:1.5px;color:${gym.brand_color};margin:0 0 4px;">${esc(heading)}</div>` : ''}${inner}`;
  });
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f1f4;">
<table role="presentation" width="100%" style="background:#f0f1f4;"><tr><td align="center" style="padding:24px 10px;">
<table role="presentation" width="600" style="width:600px;max-width:100%;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
<tr><td style="background:${gym.brand_color};padding:18px 32px;color:#ffffff;font-size:13px;letter-spacing:3px;font-weight:bold;">${esc(gym.name.toUpperCase())}</td></tr>
<tr><td style="padding:28px 32px;font-size:16px;line-height:1.6;color:#1f2533;">
${blocks.map((b) => `<div style="margin:0 0 16px;">${b}</div>`).join('\n')}
<p style="margin:0;font-weight:bold;">${esc(gym.name)}<br><span style="font-weight:normal;">${esc(gym.phone ?? '')}</span></p>
</td></tr>
<tr><td style="background:${gym.brand_color};padding:14px 32px;color:#dedee2;font-size:12px;text-align:center;">${esc([gym.name, gym.address, gym.phone].filter(Boolean).join(' · '))}</td></tr>
</table></td></tr></table></body></html>`;
}

import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { addDays, ymdInZone } from '@/lib/dates';
import { partyRecipientProblem, recipientProblem, sendPartyTemplate, sendTemplate } from '@/lib/messaging';
import type { Party } from '@/lib/parties';
import type { Gym, Template, TemplateKey, Trial } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Runs once a day (see vercel.json, 23:00 UTC ≈ late afternoon in Boise):
 *  - first-day reminders for tomorrow's first days
 *  - follow-ups for families who showed up yesterday
 *  - follow-up 2 (No-Risk First Day policy) two days after a first day
 *  - party reminders 3 days before, party thank-yous the day after
 * Only templates with "Send automatically" turned on are sent.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}` || !process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }
  const db = createAdminClient();
  const { data: gyms } = await db.from('gyms').select('*');
  const summary: Record<string, { reminders: number; followUps: number; followUps2: number; partyReminders: number; partyThanks: number; failed: number }> = {};

  for (const gym of (gyms ?? []) as Gym[]) {
    const today = ymdInZone(new Date(), gym.timezone);
    const { data: tpls } = await db.from('templates').select('*').eq('gym_id', gym.id).eq('auto_send', true);
    const auto = (key: TemplateKey) => ((tpls ?? []) as Template[]).filter((t) => t.key === key);
    const s = (summary[gym.slug] = { reminders: 0, followUps: 0, followUps2: 0, partyReminders: 0, partyThanks: 0, failed: 0 });

    const jobs: { key: TemplateKey; query: () => PromiseLike<{ data: unknown[] | null }>; count: 'reminders' | 'followUps' | 'followUps2' }[] = [
      {
        key: 'first_day_reminder', count: 'reminders',
        query: () => db.from('trials').select('*').eq('gym_id', gym.id).eq('status', 'open')
          .eq('first_day', addDays(today, 1)).is('reminder_sent_at', null),
      },
      {
        key: 'follow_up', count: 'followUps',
        query: () => db.from('trials').select('*').eq('gym_id', gym.id).eq('status', 'open')
          .eq('first_day', addDays(today, -1)).eq('showed_up', true).is('followup_sent_at', null),
      },
      {
        // No-Risk First Day reminder: two days after, once tuition has billed.
        key: 'follow_up_2', count: 'followUps2',
        query: () => db.from('trials').select('*').eq('gym_id', gym.id).in('status', ['open', 'enrolled'])
          .eq('first_day', addDays(today, -2)).eq('showed_up', true).is('followup2_sent_at', null),
      },
    ];

    for (const job of jobs) {
      const templates = auto(job.key);
      if (!templates.length) continue;
      const { data } = await job.query();
      for (const trial of (data ?? []) as Trial[]) {
        let sentAny = false;
        for (const template of templates) {
          if (recipientProblem(template.channel, trial)) continue; // e.g. no texting consent: skip quietly
          const res = await sendTemplate({ db, gym, trial, template, actor: 'Auto' });
          if (res.ok) sentAny = true; else s.failed++;
        }
        if (sentAny) s[job.count]++;
      }
    }

    // Birthday parties: reminder 3 days before, thank-you the day after.
    const partyJobs: { key: TemplateKey; date: string; stamp: 'reminder_sent_at' | 'thanks_sent_at'; count: 'partyReminders' | 'partyThanks' }[] = [
      { key: 'party_reminder', date: addDays(today, 3), stamp: 'reminder_sent_at', count: 'partyReminders' },
      { key: 'party_thank_you', date: addDays(today, -1), stamp: 'thanks_sent_at', count: 'partyThanks' },
    ];
    for (const job of partyJobs) {
      const templates = auto(job.key).filter((t) => t.channel === 'email');
      if (!templates.length) continue;
      const { data } = await db.from('parties').select('*').eq('gym_id', gym.id).in('status', ['booked', 'completed'])
        .eq('party_date', job.date).is(job.stamp, null);
      for (const party of (data ?? []) as Party[]) {
        if (partyRecipientProblem('email', party)) continue;
        const res = await sendPartyTemplate({ db, gym, party, template: templates[0], actor: 'Auto' });
        if (res.ok) s[job.count]++; else s.failed++;
      }
    }
  }
  return NextResponse.json({ ok: true, summary });
}

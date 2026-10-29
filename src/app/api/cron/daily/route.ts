import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { addDays, ymdInZone } from '@/lib/dates';
import { recipientProblem, sendTemplate } from '@/lib/messaging';
import type { Gym, Template, TemplateKey, Trial } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Runs once a day (see vercel.json, 23:00 UTC ≈ late afternoon in Boise):
 *  - first-day reminders for tomorrow's first days
 *  - follow-ups for families who showed up yesterday
 * Only templates with "Send automatically" turned on are sent.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}` || !process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }
  const db = createAdminClient();
  const { data: gyms } = await db.from('gyms').select('*');
  const summary: Record<string, { reminders: number; followUps: number; failed: number }> = {};

  for (const gym of (gyms ?? []) as Gym[]) {
    const today = ymdInZone(new Date(), gym.timezone);
    const { data: tpls } = await db.from('templates').select('*').eq('gym_id', gym.id).eq('auto_send', true);
    const auto = (key: TemplateKey) => ((tpls ?? []) as Template[]).filter((t) => t.key === key);
    const s = (summary[gym.slug] = { reminders: 0, followUps: 0, failed: 0 });

    const jobs: { key: TemplateKey; query: () => PromiseLike<{ data: unknown[] | null }>; count: 'reminders' | 'followUps' }[] = [
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
  }
  return NextResponse.json({ ok: true, summary });
}

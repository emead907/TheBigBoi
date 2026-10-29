import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getGymContext } from '@/lib/gym';
import { stageOf, STAGES } from '@/lib/stages';
import { ageOn, formatDateTime, formatDay } from '@/lib/dates';
import type { Activity, Message, Template, Trial } from '@/lib/types';
import { renderTemplate, templateVars } from '@/lib/templates';
import { channelReady, recipientProblem, TEMPLATE_LABEL } from '@/lib/messaging';
import TrialEditor from '@/components/TrialEditor';
import SendPanel from '@/components/SendPanel';

export const dynamic = 'force-dynamic';

export default async function TrialPage({ params }: { params: { gym: string; id: string } }) {
  const ctx = await getGymContext(params.gym);
  const supabase = createClient();
  const [{ data: trialData }, { data: acts }, { data: msgs }, { data: tpls }] = await Promise.all([
    supabase.from('trials').select('*').eq('id', params.id).eq('gym_id', ctx.gym.id).maybeSingle(),
    supabase.from('activity').select('*').eq('trial_id', params.id).order('created_at', { ascending: false }).limit(100),
    supabase.from('messages').select('*').eq('trial_id', params.id).order('created_at', { ascending: false }).limit(50),
    supabase.from('templates').select('*').eq('gym_id', ctx.gym.id),
  ]);
  if (!trialData) notFound();
  const trial = trialData as Trial;
  const stage = stageOf(trial, ctx.today);
  const stageIndex = STAGES.findIndex((s) => s.key === stage);
  const vars = templateVars(trial, ctx.gym);

  const options = ((tpls ?? []) as Template[])
    .sort((a, b) => ['spot_ready', 'first_day_reminder', 'follow_up'].indexOf(a.key) - ['spot_ready', 'first_day_reminder', 'follow_up'].indexOf(b.key) || a.channel.localeCompare(b.channel))
    .map((t) => ({
      key: t.key, channel: t.channel, label: TEMPLATE_LABEL[t.key],
      subject: t.subject ? renderTemplate(t.subject, vars) : null,
      body: renderTemplate(t.body, vars),
      blocked: channelReady(t.channel, ctx.gym) ?? recipientProblem(t.channel, trial),
    }));

  // Merge activity and messages into one timeline.
  const timeline = [
    ...((acts ?? []) as Activity[]).map((a) => ({ id: `a${a.id}`, at: a.created_at, who: a.actor ?? 'Someone', text: a.detail ?? a.kind, failed: a.kind === 'message_failed' })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/${ctx.gym.slug}?stage=${stage}`} className="text-sm font-semibold text-slate-brand hover:text-navy">← Back to board</Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="eyebrow">{trial.class_name}{trial.requested_time ? ` · ${trial.requested_time}` : ''}</div>
            <h1 className="display text-5xl leading-none">{trial.child_name}</h1>
            <p className="mt-1 text-sm text-slate-brand">
              {ageOn(trial.birthday, ctx.today)}{trial.birthday ? ` · born ${formatDay(trial.birthday, { year: true })} · ` : ''}
              Requested {formatDateTime(trial.received_at, ctx.gym.timezone)} via {trial.source.replace('_', '-')}
            </p>
          </div>
        </div>
      </div>

      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-6" aria-label="Progress">
        {STAGES.map((s, i) => {
          const done = stage === 'closed' ? i < 3 && i <= stageIndex : i < stageIndex;
          const here = s.key === stage;
          return (
            <li key={s.key} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
              here ? 'border-navy bg-navy text-white' : done ? 'border-steel bg-white text-navy' : 'border-mist bg-white text-[#9aa3b2]'}`}>
              {here ? '● ' : done ? '✓ ' : ''}{s.label}
            </li>
          );
        })}
      </ol>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <TrialEditor slug={ctx.gym.slug} trial={trial} stage={stage} isOwner={ctx.role === 'owner'} />
        <div className="space-y-5">
          <SendPanel slug={ctx.gym.slug} trialId={trial.id} options={options} />
          <section className="card p-5">
            <h2 className="display text-2xl">Activity</h2>
            {timeline.length === 0 ? <p className="mt-2 text-sm text-slate-brand">Nothing yet.</p> : (
              <ul className="mt-3 space-y-3">
                {timeline.map((e) => (
                  <li key={e.id} className="text-sm">
                    <div className={e.failed ? 'text-red-700' : ''}><strong>{e.who}</strong> · {e.text}</div>
                    <div className="text-xs text-slate-brand">{formatDateTime(e.at, ctx.gym.timezone)}</div>
                  </li>
                ))}
              </ul>
            )}
            {(msgs ?? []).length > 0 && (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer font-semibold text-navy">Messages sent ({(msgs ?? []).length})</summary>
                <ul className="mt-2 space-y-3">
                  {((msgs ?? []) as Message[]).map((m) => (
                    <li key={m.id} className="rounded-lg bg-paper p-3">
                      <div className="text-xs font-semibold text-slate-brand">
                        {m.channel === 'email' ? 'Email' : 'Text'} to {m.to_address} · {formatDateTime(m.created_at, ctx.gym.timezone)}
                        {m.status !== 'sent' && <span className="text-red-700"> · not sent</span>}
                      </div>
                      {m.subject && <div className="mt-1 font-semibold">{m.subject}</div>}
                      <p className="mt-1 whitespace-pre-line text-xs">{m.body}</p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

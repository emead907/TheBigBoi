import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getGymContext } from '@/lib/gym';
import { stageOf, waitlistPositions } from '@/lib/stages';
import { ageOn, formatDateTime, formatDay } from '@/lib/dates';
import type { Activity, Template, Trial } from '@/lib/types';
import { renderTemplate, templateVars } from '@/lib/templates';
import { channelReady, recipientProblem, TEMPLATE_LABEL } from '@/lib/messaging';
import SendPanel from '@/components/SendPanel';
import { Avatar, Card, splitClass } from '@/components/ui';
import { ArrowLeft, Calendar, Check, Mail, Message, Note, Phone, UserPlus } from '@/components/icons';
import { ChecklistCard, DeleteRequestButton, FamilyCard, FirstDayCard, NotesCard, StatusSelect, WaitlistCard, type CheckItem } from '@/components/TrialDetail';

export const dynamic = 'force-dynamic';

export default async function TrialPage({ params }: { params: { gym: string; id: string } }) {
  const ctx = await getGymContext(params.gym);
  const supabase = createClient();
  const [{ data: trialData }, { data: acts }, { data: tpls }] = await Promise.all([
    supabase.from('trials').select('*').eq('id', params.id).eq('gym_id', ctx.gym.id).maybeSingle(),
    supabase.from('activity').select('*').eq('trial_id', params.id).order('created_at', { ascending: false }).limit(100),
    supabase.from('templates').select('*').eq('gym_id', ctx.gym.id),
  ]);
  if (!trialData) notFound();
  const trial = trialData as Trial;
  const activity = (acts ?? []) as Activity[];
  const stage = stageOf(trial, ctx.today);
  const tz = ctx.gym.timezone;
  const cls = splitClass(trial.class_name);

  // Who did it, and when, for checklist sub-lines.
  const by = (match: RegExp, at: string | null) => {
    const a = activity.find((x) => match.test(x.detail ?? ''));
    const when = a?.created_at ?? at;
    if (!when) return '';
    const day = new Date(when).toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric' });
    return a ? `${a.actor ?? 'Someone'} · ${day}` : day;
  };

  // Progress steps
  const done = {
    requested: true,
    spot: !!trial.spot_email_sent_at,
    scheduled: !!trial.first_day,
    firstDay: !!trial.first_day && (trial.first_day <= ctx.today || trial.showed_up != null),
    enrolled: trial.status === 'enrolled',
  };
  const steps = [
    { label: 'Requested', done: done.requested },
    { label: 'Spot ready', done: done.spot },
    { label: 'Scheduled', done: done.scheduled },
    { label: 'First day', done: done.firstDay },
    { label: 'Enrolled', done: done.enrolled },
  ];
  const current = steps.findIndex((s) => !s.done);
  const closed = trial.status === 'not_enrolling' || trial.status === 'no_show';
  const badge = closed ? (trial.status === 'no_show' ? 'No-show' : 'Not enrolling') : trial.status === 'enrolled' ? 'Enrolled' : stage === 'waitlist' ? 'Waitlist' : 'In progress';

  const checklist: CheckItem[] = [
    { id: 'in_sportsengine', label: 'Added to SportsEngine', done: trial.in_sportsengine, sub: trial.in_sportsengine ? `Completed by ${by(/SportsEngine/, null)}` : 'Add the family before their first day' },
    { id: 'spot_email_sent_at', label: '“Spot is ready” email sent', done: !!trial.spot_email_sent_at, sub: trial.spot_email_sent_at ? `Sent · ${by(/spot email|Spot is ready/i, trial.spot_email_sent_at)}` : 'Use Send a message, or check it off' },
    { id: 'called_at', label: 'Welcome call completed', done: !!trial.called_at, sub: trial.called_at ? `Completed by ${by(/Marked called/, trial.called_at)}` : 'Call before their first day' },
    { id: 'reminder', label: 'First-day reminder sent', done: !!trial.reminder_sent_at, auto: true, sub: trial.reminder_sent_at ? `Sent · ${by(/reminder/i, trial.reminder_sent_at)}` : 'Goes out automatically the evening before' },
  ];
  if (stage === 'follow_up' || stage === 'enrolled' || stage === 'closed' || trial.followed_up_at) {
    checklist.push({ id: 'followed_up_at', label: 'Followed up after first day', done: !!trial.followed_up_at, sub: trial.followed_up_at ? `Completed by ${by(/followed up|Follow-up/i, trial.followed_up_at)}` : 'Ask how it went and if they’re enrolling' });
  }

  const vars = templateVars(trial, ctx.gym);
  const order = ['spot_ready', 'first_day_reminder', 'follow_up'];
  const options = ((tpls ?? []) as Template[])
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key) || a.channel.localeCompare(b.channel))
    .map((t) => ({
      key: t.key, channel: t.channel, label: TEMPLATE_LABEL[t.key],
      subject: t.subject ? renderTemplate(t.subject, vars) : null,
      body: renderTemplate(t.body, vars),
      blocked: channelReady(t.channel, ctx.gym) ?? recipientProblem(t.channel, trial),
    }));
  const suggested = stage === 'new' ? 'spot_ready' : stage === 'upcoming' ? 'first_day_reminder' : 'follow_up';

  const notesBy = activity.find((a) => a.detail === 'Updated notes');

  // Waitlist position among families waiting for the same class and time.
  let waitPos: number | null = null;
  let waitTotal = 0;
  if (stage === 'waitlist') {
    const { data: peers } = await supabase.from('trials').select('id, class_name, requested_time, waitlisted_at')
      .eq('gym_id', ctx.gym.id).eq('status', 'open').is('offered_at', null).is('first_day', null)
      .not('waitlisted_at', 'is', null).eq('class_name', trial.class_name ?? '');
    const same = (peers ?? []).filter((p) => (p.requested_time ?? '') === (trial.requested_time ?? ''));
    waitPos = waitlistPositions(same)[trial.id] ?? null;
    waitTotal = same.length;
  }

  return (
    <div className="space-y-6">
      <Link href={`/${ctx.gym.slug}?stage=${stage}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to requests
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={trial.child_name} size="lg" />
          <div>
            <div className="eyebrow">Family request</div>
            <h1 className="display text-[44px] leading-[0.95]">{trial.child_name}</h1>
            <p className="mt-1 text-sm text-slate-brand">{[cls.name, cls.detail].filter(Boolean).join(' · ') || 'No class listed'}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusSelect slug={ctx.gym.slug} trial={trial} />
          {ctx.role === 'owner' && <DeleteRequestButton slug={ctx.gym.slug} id={trial.id} name={trial.child_name} />}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <WaitlistCard slug={ctx.gym.slug} trial={trial} onList={stage === 'waitlist'} position={waitPos} total={waitTotal}
            since={trial.waitlisted_at ? formatDateTime(trial.waitlisted_at, tz) : ''} canAdd={stage === 'new'} />

          <Card eyebrow="Enrollment journey" title="Stage progress"
            action={<span className={`chip ${closed ? 'bg-[#eef0f3] text-[#5b6472]' : trial.status === 'enrolled' ? 'bg-[#e3f3e9] text-stage-won' : 'bg-navy-50 text-navy'} text-[10px] uppercase tracking-wider`}>{badge}</span>}>
            <ol className="flex items-start" aria-label="Progress">
              {steps.map((s, i) => {
                const isCurrent = i === current && !closed;
                return (
                  <li key={s.label} className="relative flex flex-1 flex-col items-center text-center">
                    {i > 0 && <span className={`absolute right-1/2 top-[15px] h-0.5 w-full ${steps[i - 1].done && s.done ? 'bg-stage-won' : steps[i - 1].done ? 'bg-gradient-to-r from-stage-won to-[#d6dce5]' : 'bg-[#d6dce5]'}`} aria-hidden />}
                    <span className={`relative z-10 grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${
                      s.done ? 'bg-stage-won text-white' : isCurrent ? 'border-2 border-navy bg-white text-navy' : 'border-2 border-[#d6dce5] bg-white text-[#9aa4b4]'}`}>
                      {s.done ? <Check className="h-4 w-4" /> : i + 1}
                    </span>
                    <span className={`mt-2 text-[11px] font-semibold ${s.done ? 'text-stage-won' : isCurrent ? 'text-navy' : 'text-[#9aa4b4]'}`}>{s.label}</span>
                  </li>
                );
              })}
            </ol>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <FamilyCard slug={ctx.gym.slug} trial={trial} age={ageOn(trial.birthday, ctx.today)} />
            <FirstDayCard slug={ctx.gym.slug} trial={trial} className={cls.name} classDetail={cls.detail} />
          </div>

          <ChecklistCard slug={ctx.gym.slug} trialId={trial.id} items={checklist} showedUp={trial.showed_up}
            showAttendance={stage === 'today' || stage === 'follow_up' || trial.showed_up != null} />

          <NotesCard slug={ctx.gym.slug} trial={trial}
            lastUpdated={notesBy ? `Last updated by ${notesBy.actor ?? 'staff'}, ${formatDateTime(notesBy.created_at, tz)}` : ''} />
        </div>

        <div className="min-w-0 space-y-5">
          <SendPanel slug={ctx.gym.slug} trialId={trial.id} options={options} suggested={suggested} />
          <Card eyebrow="Latest updates" title="Activity">
            {activity.length === 0 ? <p className="text-sm text-slate-brand">Nothing yet.</p> : (
              <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-[#e3e7ee]">
                {activity.slice(0, 30).map((a) => {
                  const d = a.detail ?? a.kind;
                  const Icon = /call/i.test(d) ? Phone : /text/i.test(d) ? Message : /email|spot/i.test(d) ? Mail
                    : /first day/i.test(d) ? Calendar : a.kind === 'created' ? UserPlus : /note/i.test(d) ? Note : Check;
                  return (
                    <li key={a.id} className="relative flex gap-3">
                      <span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border bg-white ${a.kind === 'message_failed' ? 'border-red-200 text-red-600' : 'border-[#e3e7ee] text-navy'}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 pt-1">
                        <div className={`text-sm font-semibold ${a.kind === 'message_failed' ? 'text-red-700' : ''}`}>
                          {a.actor && a.actor !== 'Website' && a.actor !== 'Auto' ? `${a.actor} · ` : ''}{d}
                        </div>
                        <div className="text-xs text-slate-brand">{a.actor === 'Auto' ? 'Automatic · ' : ''}{formatDateTime(a.created_at, tz)}</div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            <p className="mt-4 border-t border-[#edf0f4] pt-3 text-xs text-slate-brand">
              Requested {formatDay(trial.received_at.slice(0, 10))} via {trial.source.replace('_', '-')}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

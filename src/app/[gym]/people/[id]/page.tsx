import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getGymContext } from '@/lib/gym';
import { ageOn, formatDay } from '@/lib/dates';
import { className } from '@/lib/people';
import { stageOf, STAGES, STATUS_LABEL } from '@/lib/stages';
import type { Trial } from '@/lib/types';
import { Avatar, Card } from '@/components/ui';
import { ArrowLeft, Calendar } from '@/components/icons';
import { SmsChip } from '@/components/PeopleDirectory';
import { AccountEditor, MemberNotes } from '@/components/PeopleEditors';

export const dynamic = 'force-dynamic';

interface Member { id: string; first_name: string; last_name: string | null; birthday: string | null; gender: string | null; classes: string[]; bookings: string[]; notes: string | null }

export default async function FamilyPage({ params }: { params: { gym: string; id: string } }) {
  const ctx = await getGymContext(params.gym);
  const db = createClient();
  const { data: acct } = await db.from('accounts').select('*, members(*)').eq('id', params.id).eq('gym_id', ctx.gym.id).maybeSingle();
  if (!acct) notFound();
  const members = ((acct.members ?? []) as Member[]).sort((a, b) => (a.birthday ?? '').localeCompare(b.birthday ?? ''));
  const name = [acct.first_name, acct.last_name].filter(Boolean).join(' ') || acct.email;

  // Trial requests from this family, matched by email.
  const { data: trialData } = acct.email
    ? await db.from('trials').select('*').eq('gym_id', ctx.gym.id).ilike('parent_email', acct.email).order('received_at', { ascending: false })
    : { data: [] };
  const trials = (trialData ?? []) as Trial[];

  return (
    <div className="space-y-6">
      <Link href={`/${ctx.gym.slug}/people`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline"><ArrowLeft className="h-4 w-4" /> Back to people</Link>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={name} size="lg" />
        <div>
          <div className="eyebrow">Family account</div>
          <h1 className="display text-[44px] leading-[0.95]">{name}</h1>
          <p className="mt-1 text-sm text-slate-brand">{members.length} athlete{members.length === 1 ? '' : 's'} · {acct.status === 'active' ? 'Active' : acct.status}</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <Card eyebrow="Athletes" title={`${members.length} on this account`}>
            {members.length === 0 ? <p className="text-sm text-slate-brand">No athletes on this account.</p> : (
              <ul className="grid gap-4 md:grid-cols-2">
                {members.map((m) => (
                  <li key={m.id} id={`m-${m.id}`} className="scroll-mt-24 rounded-xl border border-[#e3e7ee] p-4 target:border-navy target:ring-2 target:ring-navy/20">
                    <div className="flex items-center gap-3">
                      <Avatar name={[m.first_name, m.last_name].join(' ')} />
                      <div>
                        <div className="font-semibold">{[m.first_name, m.last_name].filter(Boolean).join(' ')}</div>
                        <div className="text-xs text-slate-brand">{[ageOn(m.birthday, ctx.today), m.birthday && `born ${formatDay(m.birthday, { year: true })}`, m.gender].filter(Boolean).join(' · ')}</div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="eyebrow text-[10px]">Classes</div>
                      {m.classes.length ? (
                        <ul className="mt-1 space-y-1">{m.classes.map((c) => (
                          <li key={c} className="text-sm"><span className="font-semibold">{className(c)}</span>{c.includes('|') && <span className="text-xs text-slate-brand"> · {c.split('|').slice(1).join('|').trim()}</span>}</li>
                        ))}</ul>
                      ) : <p className="text-sm text-slate-brand">Not in a class</p>}
                    </div>
                    {m.bookings.length > 0 && (
                      <div className="mt-3">
                        <div className="eyebrow text-[10px]">Upcoming events</div>
                        <ul className="mt-1 space-y-1">{m.bookings.map((b) => <li key={b} className="flex items-center gap-1.5 text-xs"><Calendar className="h-3.5 w-3.5 text-navy" />{b}</li>)}</ul>
                      </div>
                    )}
                    <MemberNotes slug={ctx.gym.slug} id={m.id} initial={m.notes ?? ''} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card eyebrow="From the trial board" title="Class requests">
            {trials.length === 0 ? <p className="text-sm text-slate-brand">No class requests from this family{acct.email ? '' : ' (no email on file to match)'}.</p> : (
              <ul className="divide-y divide-[#edf0f4]">
                {trials.map((t) => {
                  const st = stageOf(t, ctx.today);
                  return (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                      <Link href={`/${ctx.gym.slug}/trials/${t.id}`} className="font-semibold hover:text-navy hover:underline">{t.child_name} · {t.class_name}</Link>
                      <span className="text-xs text-slate-brand">{formatDay(t.received_at.slice(0, 10), { year: true })} · {t.status === 'open' ? STAGES.find((s) => s.key === st)?.label : STATUS_LABEL[t.status]}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <AccountEditor slug={ctx.gym.slug} account={{ id: acct.id, first_name: acct.first_name, last_name: acct.last_name, email: acct.email, mobile: acct.mobile, phone: acct.phone, notes: acct.notes }} />
          <Card eyebrow="Texting" title="Text messages">
            <div className="flex items-center justify-between text-sm"><span className="text-slate-brand">GoMotion status</span><SmsChip status={acct.sms_status} /></div>
            {acct.sms_status?.toLowerCase() === 'stopped' && <p className="mt-2 text-xs text-red-700">This family replied STOP. Don&apos;t text them.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}

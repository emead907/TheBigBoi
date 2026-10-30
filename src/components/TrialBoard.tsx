'use client';
import Link from 'next/link';
import { useMemo, useOptimistic, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Trial } from '@/lib/types';
import { STAGES, STATUS_LABEL, waitlistPositions, type Stage } from '@/lib/stages';
import { ageOn, formatDay } from '@/lib/dates';
import { deleteTrial, updateTrial, type TrialPatch } from '@/app/[gym]/actions';
import { Avatar, CheckBox, PageHeader, splitClass } from './ui';
import { Calendar, ChevronRight, Plus, Search, Trash } from './icons';

type Row = Trial & { stage: Stage };

const DOT: Record<Stage, string> = {
  waitlist: 'bg-stage-wait', new: 'bg-stage-new', upcoming: 'bg-stage-upcoming', today: 'bg-stage-today',
  follow_up: 'bg-stage-follow', enrolled: 'bg-stage-won', closed: 'bg-stage-lost',
};

export default function TrialBoard({ slug, timezone, today, trials, initialStage, canDelete = false }: {
  slug: string; timezone: string; today: string; trials: Row[]; initialStage: Stage; canDelete?: boolean;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>(initialStage);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [, startTransition] = useTransition();
  const [rows, applyOptimistic] = useOptimistic(trials, (state, u: { id: string; patch?: TrialPatch; remove?: boolean }) =>
    u.remove ? state.filter((t) => t.id !== u.id) : state.map((t) => (t.id === u.id ? ({ ...t, ...u.patch } as Row) : t)));

  const counts = useMemo(() => {
    const c: Record<Stage, number> = { waitlist: 0, new: 0, upcoming: 0, today: 0, follow_up: 0, enrolled: 0, closed: 0 };
    trials.forEach((t) => c[t.stage]++);
    return c;
  }, [trials]);

  const searching = query.trim().length > 0;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q
      ? rows.filter((t) => [t.child_name, t.parent_name, t.parent_email, t.parent_phone, t.class_name].some((v) => v?.toLowerCase().includes(q)))
      : rows.filter((t) => t.stage === stage);
    if (stage === 'upcoming' && !q) list = [...list].sort((a, b) => (a.first_day ?? '').localeCompare(b.first_day ?? ''));
    if (stage === 'waitlist' && !q) list = [...list].sort((a, b) =>
      `${a.class_name ?? ''}|${a.requested_time ?? ''}`.localeCompare(`${b.class_name ?? ''}|${b.requested_time ?? ''}`) || (a.waitlisted_at ?? '').localeCompare(b.waitlisted_at ?? ''));
    return list;
  }, [rows, stage, query]);
  const positions = useMemo(() => waitlistPositions(rows.filter((t) => t.stage === 'waitlist')), [rows]);

  function save(id: string, patch: TrialPatch) {
    setError('');
    startTransition(async () => {
      applyOptimistic({ id, patch });
      const res = await updateTrial(slug, id, patch);
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  }
  function remove(t: Row) {
    if (!window.confirm(`Delete ${t.child_name}'s request? Use this for tests or families you can't serve (like out-of-area leads). It's removed from the board and from all reports, and can't be undone.`)) return;
    setError('');
    startTransition(async () => {
      applyOptimistic({ id: t.id, remove: true });
      const res = await deleteTrial(slug, t.id, { stay: true });
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  }
  const view: Stage | 'search' = searching ? 'search' : stage;
  const longToday = new Date(today + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Enrollment pipeline" title="Family Requests" subtitle="Keep every family moving toward their first great day."
        right={<div className="text-sm font-semibold text-navy">{longToday}</div>} />

      <div className="-mx-4 overflow-x-auto border-b border-[#e3e7ee] px-4 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Stages" className="flex min-w-max gap-6">
          {STAGES.map((s) => {
            const on = stage === s.key && !searching;
            return (
              <button key={s.key} role="tab" aria-selected={on}
                onClick={() => { setStage(s.key); setQuery(''); router.replace(`/${slug}?stage=${s.key}`, { scroll: false }); }}
                className={`relative flex items-center gap-2 pb-3 pt-1 text-sm font-semibold transition ${on ? 'text-navy' : 'text-slate-brand hover:text-navy'}`}>
                <span className={`h-2 w-2 rounded-full ${DOT[s.key]}`} aria-hidden />
                {s.label}
                <span className="rounded-md bg-[#e9edf3] px-1.5 py-0.5 text-[11px] tabular-nums text-[#3b4658]">{counts[s.key]}</span>
                {on && <span className="absolute inset-x-0 -bottom-px h-[3px] rounded-t bg-navy" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a95a6]" />
          <input id="board-search" className="input py-2.5 pl-9" placeholder="Search child, parent, or class" value={query}
            onChange={(e) => setQuery(e.target.value)} aria-label="Search requests" />
        </label>
        <span className="text-sm text-slate-brand"><strong className="text-[#1b2433]">{visible.length}</strong> {searching ? 'matches in every stage' : visible.length === 1 ? 'request' : 'requests'}</span>
        <Link href={`/${slug}/new`} className="btn-primary ml-auto rounded-xl px-4 py-2.5"><Plus className="h-4 w-4" />Add request</Link>
      </div>

      {!searching && <p className="-mt-3 text-xs text-slate-brand">{STAGES.find((s) => s.key === stage)?.hint}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {visible.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="display text-2xl">{searching ? 'No matches' : stage === 'new' ? 'All caught up' : 'Nothing here yet'}</div>
          <p className="mt-1 text-sm text-slate-brand">{searching ? 'Try a different name or class.' : 'New families will show up here as they move along.'}</p>
        </div>
      ) : (
        <>
          <div className="card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[#e3e7ee] text-left text-[11px] font-bold uppercase tracking-[0.1em] text-slate-brand">
                  <tr>
                    <th className="py-3.5 pl-5 pr-3">Child</th>
                    <th className="px-3 py-3.5">Class</th>
                    <th className="px-3 py-3.5">Parent</th>
                    <th className="px-3 py-3.5">Received</th>
                    <Heads view={view} />
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0f4]">
                  {visible.map((t) => {
                    const late = isOverdue(t);
                    const cls = splitClass(t.class_name);
                    return (
                      <tr key={t.id} className={`group align-middle ${late ? 'bg-[#fdf1f1]' : 'hover:bg-[#f8f9fc]'}`}>
                        <td className={`py-4 pl-5 pr-3 ${late ? 'border-l-[3px] border-red-500' : 'border-l-[3px] border-transparent'}`}>
                          <div className="flex items-center gap-3">
                            <Avatar name={t.child_name} />
                            <div>
                              <Link href={`/${slug}/trials/${t.id}`} className="font-semibold text-[#1b2433] hover:text-navy hover:underline">{t.child_name}</Link>
                              <div className="text-xs text-slate-brand">{t.birthday ? `Age ${ageOn(t.birthday, today).replace(' yrs', '')}` : '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="font-semibold">{cls.name || '—'}</div>
                          <div className="text-xs text-slate-brand">{[cls.detail, t.requested_time].filter(Boolean).join(' · ')}</div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="font-semibold">{t.parent_name}</div>
                          <div className="text-xs text-slate-brand">{t.parent_phone}</div>
                        </td>
                        <td className="px-3 py-4"><Received iso={t.received_at} timezone={timezone} late={late} /></td>
                        <Cells t={t} view={view} save={save} pos={positions[t.id]} />
                        <td className="pr-4">
                          <div className="flex items-center justify-end gap-1">
                            {canDelete && (
                              <button type="button" onClick={() => remove(t)} aria-label={`Delete ${t.child_name}'s request`} title="Delete request"
                                className="grid h-8 w-8 place-items-center rounded-lg text-[#b6bfcc] opacity-0 transition hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100">
                                <Trash className="h-4 w-4" />
                              </button>
                            )}
                            <Link href={`/${slug}/trials/${t.id}`} aria-label={`Open ${t.child_name}`} className="grid h-8 w-8 place-items-center rounded-lg text-[#9aa4b4] hover:bg-white hover:text-navy">
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <ul className="space-y-3 md:hidden">
            {visible.map((t) => {
              const late = isOverdue(t);
              const cls = splitClass(t.class_name);
              return (
                <li key={t.id} className={`card overflow-hidden ${late ? 'border-l-[3px] border-l-red-500 bg-[#fdf1f1]' : ''}`}>
                  <Link href={`/${slug}/trials/${t.id}`} className="flex items-center gap-3 p-4 pb-3">
                    <Avatar name={t.child_name} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{t.child_name}</div>
                      <div className="text-xs text-slate-brand">{t.birthday ? `Age ${ageOn(t.birthday, today).replace(' yrs', '')}` : ''}{late ? ' · Needs attention' : ''}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#9aa4b4]" />
                  </Link>
                  <div className="mx-4 rounded-xl bg-[#f3f5f9] px-3 py-2.5 text-sm">
                    <div className="eyebrow text-[10px]">Class</div>
                    <div className="font-semibold">{cls.name} <span className="font-normal text-slate-brand">{cls.detail && `(${cls.detail})`}</span></div>
                    {t.requested_time && <div className="text-xs text-slate-brand">{t.requested_time}</div>}
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 text-sm">
                    <div><div className="eyebrow text-[10px]">Parent</div><div className="font-semibold">{t.parent_name}</div></div>
                    {t.parent_phone && <a href={`tel:${t.parent_phone}`} className="btn-ghost rounded-lg px-3 py-1.5 text-xs">{t.parent_phone}</a>}
                  </div>
                  <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-[#edf0f4] px-4 py-3">
                    <Cells t={t} view={view} save={save} pos={positions[t.id]} mobile />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function isOverdue(t: Row) {
  // Clock starts when the request came in, or when a waitlist spot was offered.
  return t.stage === 'new' && !t.spot_email_sent_at && Date.now() - Date.parse(t.offered_at ?? t.received_at) > 86_400_000;
}

function Received({ iso, timezone, late }: { iso: string; timezone: string; late: boolean }) {
  const d = new Date(iso);
  const day = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: timezone });
  const now = new Date();
  const yest = new Date(now.getTime() - 86_400_000);
  const label = day(d) === day(now) ? 'Today' : day(d) === day(yest) ? 'Yesterday'
    : d.toLocaleDateString('en-US', { timeZone: timezone, month: 'short', day: 'numeric' });
  return (
    <div>
      <div className="font-semibold">{label}</div>
      <div className="text-xs text-slate-brand">{d.toLocaleTimeString('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit' })}</div>
      {late && <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-red-600">Needs attention</div>}
    </div>
  );
}

function Heads({ view }: { view: Stage | 'search' }) {
  const th = (l: string, c = '') => <th className={`px-3 py-3.5 ${c}`}>{l}</th>;
  if (view === 'waitlist') return <>{th('Spot in line', 'text-center')}{th('Waiting')}{th('')}</>;
  if (view === 'new') return <>{th('SportsEngine', 'text-center')}{th('Spot email', 'text-center')}{th('Called', 'text-center')}{th('First day')}</>;
  if (view === 'upcoming') return <>{th('First day')}{th('Reminder')}</>;
  if (view === 'today') return <>{th('Time')}{th('Showed up')}</>;
  if (view === 'follow_up') return <>{th('First day')}{th('Followed up', 'text-center')}{th('Status')}</>;
  return <>{th('Stage')}{th('First day')}</>;
}

function DatePill({ t, save }: { t: Row; save: (id: string, p: TrialPatch) => void }) {
  return (
    <label className="relative inline-flex h-9 w-36 items-center gap-2 rounded-lg border border-[#d6dce5] bg-white px-2.5 text-xs font-semibold text-navy hover:border-navy">
      <Calendar className="h-4 w-4 shrink-0" />
      <span className={t.first_day ? '' : 'font-normal text-[#8a95a6]'}>{t.first_day ? formatDay(t.first_day).replace(/^\w+, /, '') : 'Select date'}</span>
      <input type="date" aria-label={`First day for ${t.child_name}`} value={t.first_day ?? ''}
        onChange={(e) => save(t.id, { first_day: e.target.value || null })}
        className="absolute inset-0 cursor-pointer opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
    </label>
  );
}

function Cells({ t, view, save, mobile, pos }: { t: Row; view: Stage | 'search'; save: (id: string, p: TrialPatch) => void; mobile?: boolean; pos?: number }) {
  const Cell = ({ children, label, center }: { children: React.ReactNode; label: string; center?: boolean }) =>
    mobile
      ? <div className="flex flex-col items-center gap-1"><span className="eyebrow text-[10px]">{label}</span>{children}</div>
      : <td className={`px-3 py-4 ${center ? 'text-center' : ''}`}>{children}</td>;
  const stamp = (on: boolean) => (on ? new Date().toISOString() : null);

  if (view === 'waitlist') {
    const days = t.waitlisted_at ? Math.max(0, Math.floor((Date.now() - Date.parse(t.waitlisted_at)) / 86_400_000)) : 0;
    return (
      <>
        <Cell label="Spot in line" center><span className="inline-grid h-8 min-w-8 place-items-center rounded-full bg-[#fbf3e1] px-2 text-sm font-bold text-stage-wait">#{pos ?? '–'}</span></Cell>
        <Cell label="Waiting"><div className="font-semibold">{days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'}`}</div><div className="text-xs text-slate-brand">since {t.waitlisted_at ? new Date(t.waitlisted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</div></Cell>
        <Cell label="">
          <button type="button" onClick={() => save(t.id, { offered_at: new Date().toISOString() })}
            className="btn-primary whitespace-nowrap rounded-lg px-3 py-1.5 text-xs">Offer spot</button>
        </Cell>
      </>
    );
  }
  if (view === 'new') return (
    <>
      <Cell label="SportsEngine" center><CheckBox label={`SportsEngine: ${t.child_name}`} checked={t.in_sportsengine} onChange={(v) => save(t.id, { in_sportsengine: v })} /></Cell>
      <Cell label="Spot email" center><CheckBox label={`Spot email sent: ${t.child_name}`} checked={!!t.spot_email_sent_at} onChange={(v) => save(t.id, { spot_email_sent_at: stamp(v) })} /></Cell>
      <Cell label="Called" center><CheckBox label={`Called: ${t.child_name}`} checked={!!t.called_at} onChange={(v) => save(t.id, { called_at: stamp(v) })} /></Cell>
      <Cell label="First day"><DatePill t={t} save={save} /></Cell>
    </>
  );
  if (view === 'upcoming') return (
    <>
      <Cell label="First day"><DatePill t={t} save={save} /></Cell>
      <Cell label="Reminder">
        <span className={`chip ${t.reminder_sent_at ? 'bg-[#e3f3e9] text-stage-won' : 'bg-[#eef1f6] text-slate-brand'}`}>
          {t.reminder_sent_at ? 'Sent' : 'Night before'}
        </span>
      </Cell>
    </>
  );
  if (view === 'today') return (
    <>
      <Cell label="Time"><span className="font-semibold">{t.first_day_time || t.requested_time || '—'}</span></Cell>
      <Cell label="Showed up">
        <div className="inline-flex overflow-hidden rounded-lg border border-[#d6dce5]">
          {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }].map((o) => (
            <button key={o.l} type="button" aria-pressed={t.showed_up === o.v}
              onClick={() => save(t.id, { showed_up: t.showed_up === o.v ? null : o.v })}
              className={`px-3.5 py-1.5 text-xs font-bold ${t.showed_up === o.v ? (o.v ? 'bg-stage-won text-white' : 'bg-red-600 text-white') : 'bg-white text-slate-brand hover:bg-[#f3f5f9]'}`}>{o.l}</button>
          ))}
        </div>
      </Cell>
    </>
  );
  if (view === 'follow_up') return (
    <>
      <Cell label="First day"><span className="font-semibold">{formatDay(t.first_day)}</span>{t.showed_up === false && <span className="ml-1 text-xs text-red-600">no-show</span>}</Cell>
      <Cell label="Followed up" center><CheckBox label={`Followed up: ${t.child_name}`} checked={!!t.followed_up_at} onChange={(v) => save(t.id, { followed_up_at: stamp(v) })} /></Cell>
      <Cell label="Status">
        <select aria-label={`Status for ${t.child_name}`} value={t.status} onChange={(e) => save(t.id, { status: e.target.value as Trial['status'] })} className="input h-9 w-40 py-1">
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Cell>
    </>
  );
  return (
    <>
      <Cell label="Stage">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold"><span className={`h-2 w-2 rounded-full ${DOT[t.stage]}`} />{STAGES.find((s) => s.key === t.stage)?.label}</span>
      </Cell>
      <Cell label="First day"><span>{formatDay(t.first_day) || '—'}</span></Cell>
    </>
  );
}

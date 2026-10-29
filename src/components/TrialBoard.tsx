'use client';
import Link from 'next/link';
import { useMemo, useOptimistic, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Trial } from '@/lib/types';
import { STAGES, STATUS_LABEL, type Stage } from '@/lib/stages';
import { ageOn, formatDay } from '@/lib/dates';
import { updateTrial, type TrialPatch } from '@/app/[gym]/actions';
import { timeAgo } from '@/lib/timeago';

type Row = Trial & { stage: Stage };

const STAGE_COLOR: Record<Stage, string> = {
  new: 'bg-stage-new', upcoming: 'bg-stage-upcoming', today: 'bg-stage-today',
  follow_up: 'bg-stage-follow', enrolled: 'bg-stage-won', closed: 'bg-stage-lost',
};

export default function TrialBoard({ slug, timezone, today, trials, initialStage }: {
  slug: string; timezone: string; today: string; trials: Row[]; initialStage: Stage;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>(initialStage);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [, startTransition] = useTransition();
  const [rows, applyOptimistic] = useOptimistic(trials, (state, u: { id: string; patch: TrialPatch }) =>
    state.map((t) => (t.id === u.id ? { ...t, ...u.patch } as Row : t)));

  const counts = useMemo(() => {
    const c: Record<Stage, number> = { new: 0, upcoming: 0, today: 0, follow_up: 0, enrolled: 0, closed: 0 };
    trials.forEach((t) => c[t.stage]++);
    return c;
  }, [trials]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows.filter((t) => t.stage === stage);
    if (q) {
      list = rows.filter((t) => [t.child_name, t.parent_name, t.parent_email, t.parent_phone, t.class_name]
        .some((v) => v?.toLowerCase().includes(q)));
    }
    if (stage === 'upcoming' && !q) list = [...list].sort((a, b) => (a.first_day ?? '').localeCompare(b.first_day ?? ''));
    return list;
  }, [rows, stage, query]);

  function save(id: string, patch: TrialPatch) {
    setError('');
    startTransition(async () => {
      applyOptimistic({ id, patch });
      const res = await updateTrial(slug, id, patch);
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  }
  const stamp = (on: boolean) => (on ? new Date().toISOString() : null);
  const current = STAGES.find((s) => s.key === stage)!;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">{formatDay(today, { year: true })}</div>
          <h1 className="display text-4xl">Trial Board</h1>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <input id="board-search" className="input sm:w-64" placeholder="Search child, parent, class…" value={query}
            onChange={(e) => setQuery(e.target.value)} aria-label="Search requests" />
          <Link href={`/${slug}/new`} className="btn-primary whitespace-nowrap">+ Add request</Link>
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4">
        <div role="tablist" className="flex min-w-max gap-2">
          {STAGES.map((s) => (
            <button key={s.key} role="tab" aria-selected={stage === s.key && !query}
              onClick={() => { setStage(s.key); setQuery(''); router.replace(`/${slug}?stage=${s.key}`, { scroll: false }); }}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                stage === s.key && !query ? 'border-navy bg-white text-navy shadow-sm' : 'border-transparent text-slate-brand hover:bg-white'}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${STAGE_COLOR[s.key]}`} aria-hidden />
              {s.label}
              <span className="rounded-full bg-paper px-2 text-xs tabular-nums text-[#1f2533]">{counts[s.key]}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-slate-brand">{query ? `Search results across every stage (${visible.length})` : current.hint}</p>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {visible.length === 0 ? (
        <div className="card p-10 text-center text-sm text-slate-brand">
          {query ? 'No matches.' : stage === 'new' ? 'No new requests. Nice work!' : 'Nothing here right now.'}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-mist text-left text-xs uppercase tracking-wider text-slate-brand">
                <tr>
                  <th className="px-4 py-3">Child</th>
                  <th className="px-3 py-3">Class</th>
                  <th className="px-3 py-3">Parent</th>
                  <StageHeaders stage={query ? 'search' : stage} />
                </tr>
              </thead>
              <tbody className="divide-y divide-mist">
                {visible.map((t) => (
                  <tr key={t.id} className={`align-top ${isOverdue(t) ? 'bg-red-50/70' : ''}`}>
                    <td className="px-4 py-3">
                      <Link href={`/${slug}/trials/${t.id}`} className="font-semibold text-navy hover:underline">{t.child_name}</Link>
                      <div className="text-xs text-slate-brand">{ageOn(t.birthday, today)}{t.birthday ? ' · ' : ''}{timeAgo(t.received_at)}</div>
                    </td>
                    <td className="px-3 py-3"><div>{t.class_name}</div><div className="text-xs text-slate-brand">{t.requested_time}</div></td>
                    <td className="px-3 py-3"><div>{t.parent_name}</div><div className="text-xs text-slate-brand">{t.parent_phone}</div></td>
                    <StageCells t={t} stage={query ? 'search' : stage} save={save} stamp={stamp} timezone={timezone} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone cards */}
          <ul className="space-y-3 md:hidden">
            {visible.map((t) => (
              <li key={t.id} className={`card p-4 ${isOverdue(t) ? 'border-red-200 bg-red-50/70' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/${slug}/trials/${t.id}`} className="font-semibold text-navy">{t.child_name}</Link>
                    <div className="text-xs text-slate-brand">{ageOn(t.birthday, today)} · {t.class_name}</div>
                    <div className="text-xs text-slate-brand">{t.requested_time}</div>
                  </div>
                  <a href={`tel:${t.parent_phone ?? ''}`} className="btn-ghost shrink-0 px-2.5 py-1 text-xs">Call</a>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <StageCells t={t} stage={query ? 'search' : stage} save={save} stamp={stamp} timezone={timezone} mobile />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function isOverdue(t: Row) {
  return t.stage === 'new' && !t.spot_email_sent_at && Date.now() - Date.parse(t.received_at) > 86_400_000;
}

function StageHeaders({ stage }: { stage: Stage | 'search' }) {
  const th = (label: string, cls = '') => <th className={`px-3 py-3 ${cls}`}>{label}</th>;
  if (stage === 'new') return <>{th('SportsEngine', 'text-center')}{th('Spot email', 'text-center')}{th('Called', 'text-center')}{th('First day')}</>;
  if (stage === 'upcoming') return <>{th('First day')}{th('Reminder')}</>;
  if (stage === 'today') return <>{th('Time')}{th('Showed up')}</>;
  if (stage === 'follow_up') return <>{th('First day')}{th('Followed up', 'text-center')}{th('Status')}</>;
  return <>{th('Stage')}{th('First day')}</>;
}

function StageCells({ t, stage, save, stamp, mobile }: {
  t: Row; stage: Stage | 'search'; save: (id: string, p: TrialPatch) => void; stamp: (on: boolean) => string | null; timezone: string; mobile?: boolean;
}) {
  const Cell = ({ children, label, center }: { children: React.ReactNode; label: string; center?: boolean }) =>
    mobile ? <label className="flex items-center gap-2"><span className="text-xs font-semibold text-slate-brand">{label}</span>{children}</label>
      : <td className={`px-3 py-3 ${center ? 'text-center' : ''}`}>{children}</td>;
  const box = (checked: boolean, onChange: (v: boolean) => void, label: string) => (
    <input type="checkbox" aria-label={`${label}: ${t.child_name}`} checked={checked} onChange={(e) => onChange(e.target.checked)}
      className="h-5 w-5 cursor-pointer accent-navy" />
  );
  const dateInput = (
    <input type="date" aria-label={`First day for ${t.child_name}`} value={t.first_day ?? ''}
      onChange={(e) => save(t.id, { first_day: e.target.value || null })} className="input w-40 py-1.5" />
  );

  if (stage === 'new') return (
    <>
      <Cell label="SportsEngine" center>{box(t.in_sportsengine, (v) => save(t.id, { in_sportsengine: v }), 'SportsEngine')}</Cell>
      <Cell label="Spot email" center>{box(!!t.spot_email_sent_at, (v) => save(t.id, { spot_email_sent_at: stamp(v) }), 'Spot email sent')}</Cell>
      <Cell label="Called" center>{box(!!t.called_at, (v) => save(t.id, { called_at: stamp(v) }), 'Called')}</Cell>
      <Cell label="First day">{dateInput}</Cell>
    </>
  );
  if (stage === 'upcoming') return (
    <>
      <Cell label="First day">{dateInput}</Cell>
      <Cell label="Reminder"><span className="text-xs text-slate-brand">{t.reminder_sent_at ? 'Sent' : 'Goes out the night before'}</span></Cell>
    </>
  );
  if (stage === 'today') return (
    <>
      <Cell label="Time"><span>{t.first_day_time || t.requested_time || '—'}</span></Cell>
      <Cell label="Showed up">
        <div className="flex gap-1">
          {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }].map((o) => (
            <button key={o.l} type="button" onClick={() => save(t.id, { showed_up: t.showed_up === o.v ? null : o.v })}
              className={`rounded-md border px-3 py-1 text-xs font-semibold ${t.showed_up === o.v
                ? (o.v ? 'border-stage-won bg-stage-won text-white' : 'border-red-600 bg-red-600 text-white')
                : 'border-mist bg-white text-slate-brand'}`}>{o.l}</button>
          ))}
        </div>
      </Cell>
    </>
  );
  if (stage === 'follow_up') return (
    <>
      <Cell label="First day"><span>{formatDay(t.first_day)}{t.showed_up === false ? ' · no-show' : ''}</span></Cell>
      <Cell label="Followed up" center>{box(!!t.followed_up_at, (v) => save(t.id, { followed_up_at: stamp(v) }), 'Followed up')}</Cell>
      <Cell label="Status">
        <select aria-label={`Status for ${t.child_name}`} value={t.status} onChange={(e) => save(t.id, { status: e.target.value as Trial['status'] })}
          className="input w-40 py-1.5">
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Cell>
    </>
  );
  return (
    <>
      <Cell label="Stage"><span className="text-xs font-semibold">{STAGES.find((s) => s.key === t.stage)?.label}</span></Cell>
      <Cell label="First day"><span>{formatDay(t.first_day) || '—'}</span></Cell>
    </>
  );
}

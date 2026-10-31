'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  DAYS, GROUP_NAMES, LEVELS, PAYMENT_DATES, byLevelThenName, eligible, feePaid, meetCost, meetDates, missingRequired, sizeCounts,
  type Practice, type TeamAthlete, type TeamEntry, type TeamExpense, type TeamFee, type TeamGroup, type TeamMeet,
} from '@/lib/team';
import { money } from '@/lib/parties';
import {
  deleteExpense, deleteMeet, saveExpense, saveFee, saveGroup, saveMeet, setEntry, updateAthlete, type AthletePatch,
} from '@/app/[gym]/team/actions';
import { Card, CheckBox } from './ui';
import { Check, ChevronRight, Plus, Search, Trash } from './icons';

export type TeamTab = 'overview' | 'roster' | 'meets' | 'leos' | 'schedule' | 'fees';

interface Props {
  slug: string; today: string; isOwner: boolean; initialTab: TeamTab;
  athletes: TeamAthlete[]; meets: TeamMeet[]; entries: TeamEntry[]; groups: TeamGroup[]; fees: TeamFee[]; expenses: TeamExpense[];
}

const LEVEL_CHIP: Record<string, string> = {
  'Level 1': 'bg-[#eef1f6] text-[#3b4658]', 'Level 2': 'bg-[#eef1f6] text-[#3b4658]', 'Level 3': 'bg-[#eef1f6] text-[#3b4658]',
  Bronze: 'bg-[#f6e7dc] text-[#8a4b1f]', Silver: 'bg-[#eceff3] text-[#4b5563]', Gold: 'bg-[#fbf0cc] text-[#7a5a00]',
  Platinum: 'bg-[#e6f1f5] text-[#235b6e]', Diamond: 'bg-[#e8e6fb] text-[#43369c]',
};
export const LevelChip = ({ level }: { level: string | null }) =>
  level ? <span className={`chip text-[11px] ${LEVEL_CHIP[level] ?? 'bg-[#eef1f6] text-[#3b4658]'}`}>{level}</span> : <span className="text-xs text-slate-brand">—</span>;

export default function TeamHub(p: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TeamTab>(p.initialTab);
  const [athletes, setAthletes] = useState(p.athletes);
  const [entries, setEntries] = useState(p.entries);
  const [fees, setFees] = useState(p.fees);
  const [error, setError] = useState('');
  const [, start] = useTransition();
  useEffect(() => setAthletes(p.athletes), [p.athletes]);
  useEffect(() => setEntries(p.entries), [p.entries]);
  useEffect(() => setFees(p.fees), [p.fees]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => { setError(''); const r = await fn(); if (!r.ok) setError(r.error ?? 'Not saved.'); router.refresh(); });
  const patchAthlete = (id: string, patch: AthletePatch) => {
    setAthletes((s) => s.map((a) => (a.id === id ? { ...a, ...patch } as TeamAthlete : a)));
    run(() => updateAthlete(p.slug, id, patch));
  };
  const toggleEntry = (meetId: string, athleteId: string, on: boolean) => {
    setEntries((s) => (on ? [...s, { meet_id: meetId, athlete_id: athleteId }] : s.filter((e) => !(e.meet_id === meetId && e.athlete_id === athleteId))));
    run(() => setEntry(p.slug, meetId, athleteId, on));
  };
  const patchFee = (athleteId: string, patch: Partial<TeamFee>) => {
    setFees((s) => {
      const has = s.some((f) => f.athlete_id === athleteId);
      const blank: TeamFee = { athlete_id: athleteId, gym_id: '', total: null, plan: null, paid_1: false, paid_2: false, paid_3: false, paid_4: false, notes: null };
      return has ? s.map((f) => (f.athlete_id === athleteId ? { ...f, ...patch } : f)) : [...s, { ...blank, ...patch }];
    });
    run(() => saveFee(p.slug, athleteId, patch));
  };

  const go = (t: TeamTab) => { setTab(t); window.history.replaceState(null, '', `?tab=${t}`); };
  const tabs: [TeamTab, string][] = [['overview', 'Overview'], ['roster', 'Roster'], ['meets', 'Meets'], ['leos', 'Leos & sizes'], ['schedule', 'Practice groups'], ...(p.isOwner ? [['fees', 'Fees & budget'] as [TeamTab, string]] : [])];
  const ctx = { ...p, athletes, entries, fees, patchAthlete, toggleEntry, patchFee, run, go };

  return (
    <div className="space-y-5">
      <div className="border-b border-[#e3e7ee]">
        <div role="tablist" className="-mb-px flex gap-6 overflow-x-auto">
          {tabs.map(([t, l]) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => go(t)}
              className={`relative whitespace-nowrap pb-3 text-sm font-semibold ${tab === t ? 'text-navy' : 'text-slate-brand hover:text-navy'}`}>
              {l}{tab === t && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t bg-navy" />}
            </button>
          ))}
        </div>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {tab === 'overview' && <Overview {...ctx} />}
      {tab === 'roster' && <Roster {...ctx} />}
      {tab === 'meets' && <Meets {...ctx} />}
      {tab === 'leos' && <Leos {...ctx} />}
      {tab === 'schedule' && <Schedule {...ctx} />}
      {tab === 'fees' && p.isOwner && <Fees {...ctx} />}
    </div>
  );
}

type Ctx = Props & {
  patchAthlete: (id: string, patch: AthletePatch) => void;
  toggleEntry: (meetId: string, athleteId: string, on: boolean) => void;
  patchFee: (athleteId: string, patch: Partial<TeamFee>) => void;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
  go: (t: TeamTab) => void;
};

const Name = ({ slug, a }: { slug: string; a: TeamAthlete }) => (
  <Link href={`/${slug}/team/${a.id}`} className="font-semibold text-[#1b2433] hover:text-navy hover:underline">{a.name}</Link>
);

/* ───────────────────────── Overview ───────────────────────── */
function Overview({ slug, athletes, meets, entries, today, patchAthlete, go }: Ctx) {
  const byLevel = LEVELS.map((l) => [l, athletes.filter((a) => a.level === l).length] as const);
  const lists: { title: string; hint: string; rows: TeamAthlete[]; action?: (a: TeamAthlete) => React.ReactNode; extra?: (a: TeamAthlete) => string }[] = [
    { title: 'Contract not signed', hint: 'Unsigned team contracts', rows: athletes.filter((a) => !a.contract_signed),
      action: (a) => <button className="btn-ghost h-8 px-2.5 text-xs" onClick={() => patchAthlete(a.id, { contract_signed: true })}><Check className="h-3.5 w-3.5" />Signed</button> },
    { title: 'USA Gymnastics membership', hint: 'Not marked as a valid member', rows: athletes.filter((a) => !a.usag_member),
      action: (a) => <button className="btn-ghost h-8 px-2.5 text-xs" onClick={() => patchAthlete(a.id, { usag_member: true })}><Check className="h-3.5 w-3.5" />Valid</button> },
    { title: 'Backpacks to hand out', hint: 'New athletes who still need one', rows: athletes.filter((a) => a.backpack_needed && !a.backpack_given),
      action: (a) => <button className="btn-ghost h-8 px-2.5 text-xs" onClick={() => patchAthlete(a.id, { backpack_given: true })}><Check className="h-3.5 w-3.5" />Given</button> },
    { title: 'Missing a required meet', hint: 'Not signed up for a required meet at their level',
      rows: athletes.filter((a) => missingRequired(a, meets, entries).length > 0),
      extra: (a) => missingRequired(a, meets, entries).map((m) => m.name).join(', ') },
  ];
  const upcoming = meets.filter((m) => !m.start_date || (m.end_date ?? m.start_date) >= today).slice(0, 4);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <div className="card p-4"><div className="text-sm font-semibold text-slate-brand">Athletes</div><div className="mt-1 font-display text-4xl leading-none text-navy tabular-nums">{athletes.length}</div></div>
        <div className="card p-4"><div className="text-sm font-semibold text-slate-brand">New this season</div><div className="mt-1 font-display text-4xl leading-none text-navy tabular-nums">{athletes.filter((a) => a.is_new).length}</div></div>
        {upcoming[0] && (
          <div className="card col-span-2 p-4 lg:col-span-3">
            <div className="text-sm font-semibold text-slate-brand">Next meet</div>
            <div className="mt-1 font-display text-3xl leading-none text-navy">{upcoming[0].name}</div>
            <div className="mt-1 text-sm text-slate-brand">{meetDates(upcoming[0])}{upcoming[0].location ? ` · ${upcoming[0].location}` : ''} · {entries.filter((e) => e.meet_id === upcoming[0].id).length} signed up</div>
          </div>
        )}
      </div>

      <Card eyebrow="By level" title="Athletes per level">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {byLevel.map(([l, n]) => (
            <div key={l} className="rounded-xl border border-[#e3e7ee] p-3 text-center">
              <LevelChip level={l} />
              <div className="mt-1.5 font-display text-3xl leading-none text-navy tabular-nums">{n}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {lists.map((l) => (
          <Card key={l.title} eyebrow={l.hint} title={`${l.title} (${l.rows.length})`}>
            {l.rows.length === 0 ? <p className="flex items-center gap-2 text-sm text-stage-won"><Check className="h-4 w-4" />All set.</p> : (
              <ul className="divide-y divide-[#edf0f4]">
                {[...l.rows].sort(byLevelThenName).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0"><Name slug={slug} a={a} /> <span className="ml-1"><LevelChip level={a.level} /></span>
                      {l.extra && <div className="truncate text-xs text-slate-brand">{l.extra(a)}</div>}</div>
                    {l.action?.(a)}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      <Card eyebrow="Coming up" title="Meets" action={<button className="text-sm font-semibold text-navy hover:underline" onClick={() => go('meets')}>All meets →</button>}>
        <ul className="divide-y divide-[#edf0f4]">
          {upcoming.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div><span className="font-semibold">{m.name}</span>{m.required && <span className="chip ml-2 bg-navy-50 text-[10px] uppercase tracking-wider text-navy">Required</span>}
                <div className="text-xs text-slate-brand">{meetDates(m)}{m.location ? ` · ${m.location}` : ''}</div></div>
              <span className="text-sm font-semibold tabular-nums">{entries.filter((e) => e.meet_id === m.id).length} signed up</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ───────────────────────── Roster ───────────────────────── */
function Roster({ slug, athletes, patchAthlete }: Ctx) {
  const [q, setQ] = useState('');
  const [level, setLevel] = useState('');
  const [group, setGroup] = useState('');
  const needle = q.trim().toLowerCase();
  const rows = athletes
    .filter((a) => (!level || a.level === level) && (!group || (group === 'none' ? !a.group_name : a.group_name === group)))
    .filter((a) => !needle || [a.name, a.mom_email, a.dad_email].some((v) => v?.toLowerCase().includes(needle)))
    .sort(byLevelThenName);
  const checks: [keyof TeamAthlete, string][] = [['contract_signed', 'Contract'], ['usag_member', 'USAG']];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a95a6]" />
          <input aria-label="Search athletes" className="input py-2.5 pl-9" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select aria-label="Filter by level" className="input w-auto py-2.5" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">All levels</option>{LEVELS.map((l) => <option key={l}>{l}</option>)}
        </select>
        <select aria-label="Filter by group" className="input w-auto py-2.5" value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">All groups</option>{GROUP_NAMES.map((g) => <option key={g}>{g}</option>)}<option value="none">No group</option>
        </select>
        <span className="text-sm text-slate-brand"><strong className="text-[#1b2433]">{rows.length}</strong> athletes</span>
      </div>
      <div className="card overflow-hidden"><div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-[#e3e7ee] text-left text-[11px] font-bold uppercase tracking-[0.1em] text-slate-brand">
            <tr><th className="py-3.5 pl-5 pr-3">Athlete</th><th className="px-3">Level</th><th className="px-3">Group</th><th className="px-3 text-right">Hours</th>
              {checks.map(([, l]) => <th key={l} className="px-3 text-center">{l}</th>)}<th className="px-3 text-center">Backpack</th><th className="px-3">Parent email</th><th className="w-10" /></tr>
          </thead>
          <tbody className="divide-y divide-[#edf0f4]">
            {rows.map((a) => (
              <tr key={a.id} className="hover:bg-[#f8f9fc]">
                <td className="py-2.5 pl-5 pr-3"><Name slug={slug} a={a} />{a.is_new && <span className="chip ml-2 bg-[#e3f3e9] text-[10px] uppercase tracking-wider text-stage-won">New</span>}</td>
                <td className="px-3"><LevelChip level={a.level} /></td>
                <td className="px-3 whitespace-nowrap">{a.group_name ?? <span className="text-slate-brand">—</span>}</td>
                <td className="px-3 text-right tabular-nums">{a.hours ?? '—'}</td>
                {checks.map(([k, l]) => (
                  <td key={k} className="px-3 text-center"><CheckBox label={`${l}: ${a.name}`} checked={!!a[k]} onChange={(v) => patchAthlete(a.id, { [k]: v })} /></td>
                ))}
                <td className="px-3 text-center">{a.backpack_needed
                  ? <CheckBox label={`Backpack given: ${a.name}`} checked={a.backpack_given} onChange={(v) => patchAthlete(a.id, { backpack_given: v })} />
                  : <span className="text-xs text-slate-brand">—</span>}</td>
                <td className="max-w-[220px] truncate px-3 text-xs">{a.mom_email ?? a.dad_email ?? <span className="text-slate-brand">—</span>}</td>
                <td className="pr-4"><Link href={`/${slug}/team/${a.id}`} aria-label={`Open ${a.name}`} className="grid h-8 w-8 place-items-center rounded-lg text-[#9aa4b4] hover:text-navy"><ChevronRight className="h-4 w-4" /></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
      <p className="text-xs text-slate-brand">Backpack column only shows a box for athletes marked as needing one (new athletes).</p>
    </div>
  );
}

/* ───────────────────────── Meets ───────────────────────── */
function Meets({ slug, athletes, meets, entries, isOwner, toggleEntry, run }: Ctx) {
  const [open, setOpen] = useState<string | null>(meets[0]?.id ?? null);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  return (
    <div className="space-y-4">
      {isOwner && editing !== 'new' && <button className="btn-ghost rounded-xl" onClick={() => setEditing('new')}><Plus className="h-4 w-4" />Add meet</button>}
      {editing === 'new' && <MeetForm slug={slug} meet={null} onDone={() => setEditing(null)} run={run} />}
      {meets.map((m) => {
        const signed = new Set(entries.filter((e) => e.meet_id === m.id).map((e) => e.athlete_id));
        const pool = athletes.filter((a) => eligible(a, m) || signed.has(a.id)).sort(byLevelThenName);
        const cost = meetCost(m, athletes, entries);
        const isOpen = open === m.id;
        return (
          <section key={m.id} className="card overflow-hidden">
            <button className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left hover:bg-[#f8f9fc]" onClick={() => setOpen(isOpen ? null : m.id)} aria-expanded={isOpen}>
              <div>
                <div className="flex items-center gap-2"><span className="display text-2xl leading-none">{m.name}</span>
                  {m.required ? <span className="chip bg-navy-50 text-[10px] uppercase tracking-wider text-navy">Required</span> : <span className="chip bg-[#eef1f6] text-[10px] uppercase tracking-wider text-slate-brand">Optional</span>}</div>
                <div className="mt-1 text-xs text-slate-brand">{meetDates(m)}{m.location ? ` · ${m.location}` : ''}{m.levels.length ? ` · ${m.levels.join(', ')}` : ''}</div>
              </div>
              <div className="text-right"><div className="font-display text-3xl leading-none text-navy tabular-nums">{signed.size}</div><div className="text-[11px] font-semibold text-slate-brand">signed up</div></div>
            </button>
            {isOpen && (
              <div className="border-t border-[#edf0f4] px-5 py-4">
                {editing === m.id ? <MeetForm slug={slug} meet={m} onDone={() => setEditing(null)} run={run} /> : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {[...new Set(pool.map((a) => a.level ?? '—'))].map((lv) => (
                        <div key={lv}>
                          <div className="mb-1.5 flex items-center gap-2"><LevelChip level={lv} /><span className="text-xs text-slate-brand">{pool.filter((a) => (a.level ?? '—') === lv && signed.has(a.id)).length}/{pool.filter((a) => (a.level ?? '—') === lv).length}</span></div>
                          <ul className="space-y-1">
                            {pool.filter((a) => (a.level ?? '—') === lv).map((a) => (
                              <li key={a.id}><label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" className="h-4 w-4 accent-navy" checked={signed.has(a.id)} onChange={(e) => toggleEntry(m.id, a.id, e.target.checked)} />
                                <span className={signed.has(a.id) ? '' : 'text-slate-brand'}>{a.name}</span></label></li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                    {isOwner && (
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0f4] pt-3 text-sm">
                        <span className="text-slate-brand">Estimated entry fees: <strong className="text-[#1b2433]">{money(cost.total)}</strong>{cost.unknown && ' (some levels have no fee set)'}</span>
                        <span className="flex gap-2">
                          <button className="btn-ghost h-9 px-3 text-xs" onClick={() => setEditing(m.id)}>Edit meet</button>
                          <button className="btn-ghost h-9 px-3 text-xs text-red-700" onClick={() => { if (window.confirm(`Delete ${m.name} and its sign-ups?`)) run(() => deleteMeet(slug, m.id)); }}><Trash className="h-3.5 w-3.5" /></button>
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function MeetForm({ slug, meet, onDone, run }: { slug: string; meet: TeamMeet | null; onDone: () => void; run: Ctx['run'] }) {
  const [f, setF] = useState({
    name: meet?.name ?? '', start_date: meet?.start_date ?? '', end_date: meet?.end_date ?? '', location: meet?.location ?? '',
    required: meet?.required ?? false, levels: meet?.levels ?? [...LEVELS.slice(1)], fees: meet?.fees ?? {}, team_fee: meet?.team_fee ?? 0, notes: meet?.notes ?? '',
  });
  return (
    <form className="card grid gap-3 p-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => saveMeet(slug, meet?.id ?? null, f)); onDone(); }}>
      <div className="sm:col-span-2"><label className="label text-[10px]" htmlFor="m-name">Meet name</label><input id="m-name" className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div><label className="label text-[10px]" htmlFor="m-start">Starts</label><input id="m-start" type="date" className="input" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></div>
      <div><label className="label text-[10px]" htmlFor="m-end">Ends</label><input id="m-end" type="date" className="input" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></div>
      <div className="sm:col-span-2"><label className="label text-[10px]" htmlFor="m-loc">Location</label><input id="m-loc" className="input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="h-4 w-4 accent-navy" checked={f.required} onChange={(e) => setF({ ...f, required: e.target.checked })} />Required meet</label>
      <fieldset className="sm:col-span-2"><legend className="label text-[10px]">Levels competing and entry fee per athlete</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{LEVELS.map((l) => (
          <div key={l} className="flex items-center gap-2 text-sm">
            <input type="checkbox" aria-label={`${l} competes`} className="h-4 w-4 accent-navy" checked={f.levels.includes(l)} onChange={(e) => setF({ ...f, levels: e.target.checked ? [...f.levels, l] : f.levels.filter((x) => x !== l) })} />
            <span className="w-16">{l}</span>
            <input aria-label={`${l} fee`} type="number" min="0" step="0.01" className="input h-8 w-20 px-2 py-1 text-xs" placeholder="$" value={f.fees[l] ?? ''}
              onChange={(e) => { const fees = { ...f.fees }; if (e.target.value === '') delete fees[l]; else fees[l] = Number(e.target.value); setF({ ...f, fees }); }} />
          </div>
        ))}</div>
      </fieldset>
      <div><label className="label text-[10px]" htmlFor="m-team">Team fee (per level entered)</label><input id="m-team" type="number" min="0" className="input" value={f.team_fee} onChange={(e) => setF({ ...f, team_fee: Number(e.target.value) })} /></div>
      <div><label className="label text-[10px]" htmlFor="m-notes">Notes</label><input id="m-notes" className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      <div className="flex gap-2 sm:col-span-2"><button className="btn-primary rounded-xl">Save meet</button><button type="button" className="btn-ghost rounded-xl" onClick={onDone}>Cancel</button></div>
    </form>
  );
}

/* ───────────────────────── Leos ───────────────────────── */
function Leos({ slug, athletes, patchAthlete }: Ctx) {
  const tables: [string, (a: TeamAthlete) => string | null][] = [
    ['Competition leo', (a) => a.comp_leo_size], ['Practice leo', (a) => a.practice_leo_size], ['Warm-up (full zip)', (a) => a.warmup_size],
  ];
  const waiting = athletes.filter((a) => a.practice_leo_size && !a.practice_leo_received).sort(byLevelThenName);
  const noSize = athletes.filter((a) => !a.comp_leo_size).sort(byLevelThenName);
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        {tables.map(([title, get]) => {
          const counts = sizeCounts(athletes.map(get));
          return (
            <Card key={title} eyebrow="Size counts" title={title}>
              <table className="w-full text-sm"><tbody className="divide-y divide-[#edf0f4]">
                {counts.map(([s, n]) => <tr key={s}><td className="py-1.5 font-semibold">{s}</td><td className="py-1.5 text-right tabular-nums">{n}</td></tr>)}
                <tr><td className="pt-2 text-xs font-bold uppercase tracking-wider text-slate-brand">Total</td><td className="pt-2 text-right font-bold tabular-nums">{counts.reduce((t, [, n]) => t + n, 0)}</td></tr>
              </tbody></table>
              <p className="mt-2 text-xs text-slate-brand">{athletes.filter((a) => !get(a)).length} with no size yet</p>
            </Card>
          );
        })}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card eyebrow="Practice leos" title={`Not received yet (${waiting.length})`}>
          {waiting.length === 0 ? <p className="text-sm text-stage-won">Everyone has theirs.</p> : (
            <ul className="divide-y divide-[#edf0f4]">{waiting.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2"><span><Name slug={slug} a={a} /> <span className="text-xs text-slate-brand">· {a.practice_leo_size}</span></span>
                <button className="btn-ghost h-8 px-2.5 text-xs" onClick={() => patchAthlete(a.id, { practice_leo_received: true })}><Check className="h-3.5 w-3.5" />Received</button></li>
            ))}</ul>
          )}
        </Card>
        <Card eyebrow="Competition leos" title={`No size on file (${noSize.length})`}>
          <ul className="divide-y divide-[#edf0f4]">{noSize.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2"><Name slug={slug} a={a} /><LevelChip level={a.level} /></li>
          ))}</ul>
        </Card>
      </div>
      <Card eyebrow="Everyone" title="All sizes">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-left text-[11px] font-bold uppercase tracking-[0.1em] text-slate-brand"><tr><th className="py-2">Athlete</th><th>Level</th><th>Comp leo</th><th>Practice leo</th><th className="text-center">Received</th><th>Warm-up</th></tr></thead>
          <tbody className="divide-y divide-[#edf0f4]">{[...athletes].sort(byLevelThenName).map((a) => (
            <tr key={a.id}><td className="py-2"><Name slug={slug} a={a} /></td><td><LevelChip level={a.level} /></td>
              <td>{a.comp_leo_size ?? '—'}</td><td>{a.practice_leo_size ?? '—'}</td>
              <td className="text-center"><CheckBox label={`Practice leo received: ${a.name}`} checked={a.practice_leo_received} onChange={(v) => patchAthlete(a.id, { practice_leo_received: v })} /></td>
              <td>{a.warmup_size ?? '—'}</td></tr>
          ))}</tbody>
        </table></div>
      </Card>
    </div>
  );
}

/* ───────────────────────── Schedule ───────────────────────── */
function Schedule({ slug, athletes, groups, isOwner, run }: Ctx) {
  const [editing, setEditing] = useState<string | null>(null);
  const slots = DAYS.map((d) => ({ day: d, items: groups.flatMap((g) => g.practices.filter((p) => p.day === d).map((p) => ({ ...p, group: g.name }))) })).filter((d) => d.items.length);
  return (
    <div className="space-y-5">
      <Card eyebrow="Week at a glance" title="Practice schedule">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {slots.map((d) => (
            <div key={d.day} className="rounded-xl border border-[#e3e7ee] p-3">
              <div className="eyebrow text-[10px]">{d.day}</div>
              <ul className="mt-2 space-y-2">{d.items.map((p, i) => (
                <li key={i} className="text-sm"><div className="font-semibold">{p.group}</div><div className="text-xs text-slate-brand">{p.time}{p.coach ? ` · ${p.coach}` : ''}</div>
                  <div className="text-xs text-slate-brand">{athletes.filter((a) => a.group_name === p.group).length} athletes</div></li>
              ))}</ul>
            </div>
          ))}
        </div>
      </Card>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => {
          const kids = athletes.filter((a) => a.group_name === g.name).sort(byLevelThenName);
          return (
            <Card key={g.id} eyebrow={g.label ?? ''} title={`${g.name} (${kids.length})`}
              action={isOwner && editing !== g.id ? <button className="text-sm font-semibold text-navy hover:underline" onClick={() => setEditing(g.id)}>Edit</button> : undefined}>
              {editing === g.id ? <GroupForm slug={slug} g={g} run={run} onDone={() => setEditing(null)} /> : (
                <>
                  {g.practices.length ? <ul className="mb-3 space-y-0.5 text-sm">{g.practices.map((p, i) => <li key={i}><strong>{p.day}</strong> {p.time}{p.coach ? <span className="text-slate-brand"> · {p.coach}</span> : ''}</li>)}</ul>
                    : <p className="mb-3 text-sm text-slate-brand">No practice times set.</p>}
                  <ul className="flex flex-wrap gap-1.5">{kids.map((a) => <li key={a.id}><Link href={`/${slug}/team/${a.id}`} className="chip bg-[#eef1f6] text-xs text-[#1b2433] hover:bg-navy-50">{a.name}</Link></li>)}</ul>
                </>
              )}
            </Card>
          );
        })}
      </div>
      {athletes.some((a) => !a.group_name) && (
        <Card eyebrow="Not in a group" title="Unassigned">
          <ul className="flex flex-wrap gap-1.5">{athletes.filter((a) => !a.group_name).map((a) => <li key={a.id}><Link href={`/${slug}/team/${a.id}`} className="chip bg-[#fff6e5] text-xs text-[#8a5300]">{a.name}</Link></li>)}</ul>
        </Card>
      )}
    </div>
  );
}

function GroupForm({ slug, g, run, onDone }: { slug: string; g: TeamGroup; run: Ctx['run']; onDone: () => void }) {
  const [label, setLabel] = useState(g.label ?? '');
  const [rows, setRows] = useState<Practice[]>(g.practices.length ? g.practices : [{ day: 'Monday', time: '', coach: '' }]);
  const set = (i: number, k: keyof Practice, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => saveGroup(slug, g.id, label, rows)); onDone(); }}>
      <input aria-label="Group levels" className="input" placeholder="Levels (e.g. Bronze)" value={label} onChange={(e) => setLabel(e.target.value)} />
      {rows.map((r, i) => (
        <div key={i} className="flex gap-1.5">
          <select aria-label="Day" className="input h-9 w-28 px-2 py-1 text-xs" value={r.day} onChange={(e) => set(i, 'day', e.target.value)}>{DAYS.map((d) => <option key={d}>{d}</option>)}</select>
          <input aria-label="Time" className="input h-9 w-28 px-2 py-1 text-xs" placeholder="4:30–6:30" value={r.time} onChange={(e) => set(i, 'time', e.target.value)} />
          <input aria-label="Coach" className="input h-9 min-w-0 flex-1 px-2 py-1 text-xs" placeholder="Coach" value={r.coach} onChange={(e) => set(i, 'coach', e.target.value)} />
          <button type="button" aria-label="Remove practice" className="px-1 text-[#9aa4b4] hover:text-red-600" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash className="h-4 w-4" /></button>
        </div>
      ))}
      <button type="button" className="text-xs font-semibold text-navy hover:underline" onClick={() => setRows([...rows, { day: 'Monday', time: '', coach: '' }])}>+ Add practice</button>
      <div className="flex gap-2 pt-1"><button className="btn-primary h-9 rounded-xl px-4 text-sm">Save</button><button type="button" className="btn-ghost h-9 rounded-xl px-4 text-sm" onClick={onDone}>Cancel</button></div>
    </form>
  );
}

/* ───────────────────────── Fees & budget ───────────────────────── */
function Fees({ slug, athletes, meets, entries, fees, expenses, patchFee, run }: Ctx) {
  const feeOf = (id: string) => fees.find((f) => f.athlete_id === id);
  const totals = useMemo(() => {
    const billed = athletes.reduce((t, a) => t + Number(feeOf(a.id)?.total ?? 0), 0);
    const paid = athletes.reduce((t, a) => t + feePaid(feeOf(a.id)), 0);
    return { billed, paid, owed: billed - paid };
  }, [athletes, fees]); // eslint-disable-line react-hooks/exhaustive-deps
  const meetCosts = meets.map((m) => ({ m, c: meetCost(m, athletes, entries) }));
  const meetTotal = meetCosts.reduce((t, x) => t + x.c.total, 0);
  const expTotal = expenses.reduce((t, e) => t + Number(e.amount), 0);
  const [newExp, setNewExp] = useState({ label: '', amount: '' });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Comp fees billed', totals.billed], ['Collected', totals.paid], ['Still owed', totals.owed], ['Left after meets & expenses', totals.billed - meetTotal - expTotal]].map(([l, n]) => (
          <div key={l as string} className="card p-4"><div className="text-sm font-semibold text-slate-brand">{l}</div><div className="mt-1 font-display text-3xl leading-none text-navy tabular-nums">{money(n as number)}</div></div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card eyebrow="From sign-ups" title={`Meet entry fees · ${money(meetTotal)}`}>
          <ul className="divide-y divide-[#edf0f4] text-sm">{meetCosts.map(({ m, c }) => (
            <li key={m.id} className="flex items-center justify-between py-2"><span>{m.name} <span className="text-xs text-slate-brand">· {c.count} athletes{c.unknown ? ' · fee missing for a level' : ''}</span></span><span className="font-semibold tabular-nums">{money(c.total)}</span></li>
          ))}</ul>
          <p className="mt-2 text-xs text-slate-brand">Each athlete&rsquo;s entry fee for their level, plus the team fee once per level entered. Edit fees on the Meets tab.</p>
        </Card>
        <Card eyebrow="Other costs" title={`Expenses · ${money(expTotal)}`}>
          <ul className="divide-y divide-[#edf0f4] text-sm">{expenses.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 py-2"><span>{e.label}</span>
              <span className="flex items-center gap-2"><span className="font-semibold tabular-nums">{money(Number(e.amount))}</span>
                <button aria-label={`Delete ${e.label}`} className="text-[#9aa4b4] hover:text-red-600" onClick={() => run(() => deleteExpense(slug, e.id))}><Trash className="h-4 w-4" /></button></span></li>
          ))}</ul>
          <form className="mt-3 flex gap-2" onSubmit={(ev) => { ev.preventDefault(); run(() => saveExpense(slug, null, newExp.label, Number(newExp.amount))); setNewExp({ label: '', amount: '' }); }}>
            <input aria-label="Expense" className="input h-9 flex-1 px-2 py-1 text-sm" placeholder="e.g. Backpacks" value={newExp.label} onChange={(e) => setNewExp({ ...newExp, label: e.target.value })} required />
            <input aria-label="Amount" type="number" step="0.01" className="input h-9 w-28 px-2 py-1 text-sm" placeholder="$" value={newExp.amount} onChange={(e) => setNewExp({ ...newExp, amount: e.target.value })} required />
            <button className="btn-ghost h-9 px-3 text-sm"><Plus className="h-4 w-4" />Add</button>
          </form>
        </Card>
      </div>

      <div className="card overflow-hidden"><div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-[#e3e7ee] text-left text-[11px] font-bold uppercase tracking-[0.1em] text-slate-brand">
            <tr><th className="py-3.5 pl-5 pr-3">Athlete</th><th className="px-3">Level</th><th className="px-3">Comp fees</th><th className="px-3">Plan</th>
              {PAYMENT_DATES.map((d) => <th key={d} className="px-2 text-center">{d}</th>)}<th className="px-3 text-right">Owed</th></tr>
          </thead>
          <tbody className="divide-y divide-[#edf0f4]">
            {[...athletes].sort(byLevelThenName).map((a) => {
              const f = feeOf(a.id);
              const full = f?.plan === 'Pay in full';
              const owed = Number(f?.total ?? 0) - feePaid(f);
              return (
                <tr key={a.id} className="hover:bg-[#f8f9fc]">
                  <td className="py-2 pl-5 pr-3"><Name slug={slug} a={a} /></td>
                  <td className="px-3"><LevelChip level={a.level} /></td>
                  <td className="px-3"><input aria-label={`Comp fees for ${a.name}`} type="number" step="0.01" className="input h-8 w-24 px-2 py-1 text-xs" defaultValue={f?.total ?? ''}
                    onBlur={(e) => { const v = e.target.value === '' ? null : Number(e.target.value); if (v !== (f?.total ?? null)) patchFee(a.id, { total: v }); }} /></td>
                  <td className="px-3"><select aria-label={`Plan for ${a.name}`} className="input h-8 w-32 px-2 py-1 text-xs" value={f?.plan ?? ''} onChange={(e) => patchFee(a.id, { plan: e.target.value || null })}>
                    <option value="">—</option><option>4 payments</option><option>Pay in full</option></select></td>
                  {full ? (
                    <td colSpan={4} className="px-2 text-center"><label className="inline-flex items-center gap-2 text-xs font-semibold">
                      <input type="checkbox" className="h-4 w-4 accent-navy" checked={!!f?.paid_1} onChange={(e) => patchFee(a.id, { paid_1: e.target.checked })} />Paid in full</label></td>
                  ) : ([1, 2, 3, 4] as const).map((n) => (
                    <td key={n} className="px-2 text-center"><CheckBox label={`${PAYMENT_DATES[n - 1]} payment: ${a.name}`} checked={!!f?.[`paid_${n}`]} disabled={!f?.total}
                      onChange={(v) => patchFee(a.id, { [`paid_${n}`]: v })} /></td>
                  ))}
                  <td className={`px-3 text-right font-semibold tabular-nums ${owed > 0 ? 'text-[#8a5300]' : 'text-stage-won'}`}>{f?.total == null ? '—' : money(owed)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div></div>
    </div>
  );
}

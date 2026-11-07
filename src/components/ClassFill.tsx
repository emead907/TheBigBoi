'use client';
import { useMemo, useState } from 'react';
import type { JRClass } from '@/lib/jackrabbit';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
type Status = 'full' | 'low' | 'open' | 'unknown';
const status = (c: JRClass): Status => c.waitlistOnly || c.openings === 0 ? 'full' : c.openings == null ? 'unknown' : c.openings <= 2 ? 'low' : 'open';
const CHIP: Record<Status, [string, string]> = {
  full: ['Full / waitlist', 'bg-[#fde2e1] text-red-800'],
  low: ['Almost full', 'bg-[#fff2d6] text-[#8a5300]'],
  open: ['Open', 'bg-[#e3f3e9] text-stage-won'],
  unknown: ['—', 'bg-[#eef1f6] text-slate-brand'],
};

export default function ClassFill({ classes }: { classes: JRClass[] }) {
  const [cat, setCat] = useState('');
  const [show, setShow] = useState<Status | ''>('');
  const [q, setQ] = useState('');
  const cats = useMemo(() => [...new Set(classes.map((c) => c.category).filter(Boolean))].sort(), [classes]);
  const rows = classes
    .filter((c) => (!cat || c.category === cat) && (!show || status(c) === show) && (!q || `${c.name} ${c.instructors.join(' ')}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (DAYS.indexOf(a.days[0] ?? 'Sun') - DAYS.indexOf(b.days[0] ?? 'Sun')) || a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
  const count = (s: Status) => classes.filter((c) => status(c) === s).length;
  const spots = classes.reduce((t, c) => t + (c.openings && c.openings > 0 ? c.openings : 0), 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([['Classes', classes.length, ''], ['Full or waitlist', count('full'), 'full'], ['Almost full (1–2 spots)', count('low'), 'low'], ['Open spots in total', spots, 'open']] as const).map(([l, n, s]) => (
          <button key={l} type="button" onClick={() => setShow(show === s ? '' : (s as Status | ''))} aria-pressed={!!s && show === s}
            className={`card p-4 text-left transition ${s && show === s ? 'ring-2 ring-navy' : 'hover:bg-[#f8f9fc]'}`}>
            <div className="text-sm font-semibold text-slate-brand">{l}</div>
            <div className="mt-1 font-display text-4xl leading-none text-navy tabular-nums">{n}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input aria-label="Search classes" className="input w-full py-2.5 sm:w-64" placeholder="Search class or coach" value={q} onChange={(e) => setQ(e.target.value)} />
        {cats.length > 1 && (
          <select aria-label="Category" className="input w-auto py-2.5" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}
        <span className="text-sm text-slate-brand"><strong className="text-[#1b2433]">{rows.length}</strong> classes</span>
      </div>

      <div className="card overflow-hidden"><div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-[#e3e7ee] text-left text-[11px] font-bold uppercase tracking-[0.1em] text-slate-brand">
            <tr><th className="py-3.5 pl-5 pr-3">Class</th><th className="px-3">Day</th><th className="px-3">Time</th><th className="px-3">Ages</th><th className="px-3">Coach</th><th className="px-3 text-right">Open spots</th><th className="px-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-[#edf0f4]">
            {rows.map((c) => {
              const s = status(c);
              return (
                <tr key={c.id || `${c.name}-${c.days.join()}-${c.start}`} className="hover:bg-[#f8f9fc]">
                  <td className="py-2.5 pl-5 pr-3"><div className="font-semibold">{c.name}</div>{(c.category || c.room) && <div className="text-xs text-slate-brand">{[c.category, c.room].filter(Boolean).join(' · ')}</div>}</td>
                  <td className="px-3 whitespace-nowrap">{c.days.join(', ') || '—'}</td>
                  <td className="px-3 whitespace-nowrap">{c.start}{c.end ? `–${c.end}` : ''}</td>
                  <td className="px-3 whitespace-nowrap">{c.minAge || c.maxAge ? `${c.minAge || '?'}–${c.maxAge || '?'}` : '—'}</td>
                  <td className="px-3">{c.instructors[0] ?? '—'}</td>
                  <td className="px-3 text-right font-semibold tabular-nums">{c.openings ?? '—'}</td>
                  <td className="px-3"><span className={`chip text-[11px] ${CHIP[s][1]}`}>{CHIP[s][0]}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div></div>
      <p className="text-xs text-slate-brand">Jackrabbit shares open spots, not class size, so a class with 6 open spots could be half full or nearly empty depending on its max.</p>
    </div>
  );
}

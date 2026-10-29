'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ageOn } from '@/lib/dates';
import { className } from '@/lib/people';
import { Avatar } from './ui';
import { ChevronRight, Search } from './icons';

export interface DirMember { id: string; first_name: string; last_name: string | null; birthday: string | null; gender: string | null; classes: string[]; bookings: string[]; status: string }
export interface DirAccount { id: string; first_name: string | null; last_name: string | null; email: string | null; mobile: string | null; phone: string | null; sms_status: string | null; status: string; members: DirMember[] }

const full = (f?: string | null, l?: string | null) => [f, l].filter(Boolean).join(' ');

export default function PeopleDirectory({ slug, today, accounts, initialTab }: { slug: string; today: string; accounts: DirAccount[]; initialTab: 'families' | 'athletes' }) {
  const [tab, setTab] = useState(initialTab);
  const [q, setQ] = useState('');
  const [cls, setCls] = useState('');
  const [limit, setLimit] = useState(100);

  const athletes = useMemo(() => accounts.flatMap((a) => a.members.map((m) => ({ ...m, account: a }))), [accounts]);
  const classList = useMemo(() => {
    const c = new Map<string, number>();
    athletes.forEach((m) => new Set(m.classes.map(className)).forEach((n) => c.set(n, (c.get(n) ?? 0) + 1)));
    return [...c.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [athletes]);
  const inClass = athletes.filter((m) => m.classes.length > 0).length;

  const needle = q.trim().toLowerCase();
  const hit = (...vals: (string | null | undefined)[]) => !needle || vals.some((v) => v?.toLowerCase().includes(needle));
  const famRows = accounts.filter((a) =>
    (!cls || a.members.some((m) => m.classes.some((c) => className(c) === cls))) &&
    (hit(full(a.first_name, a.last_name), a.email, a.mobile, a.phone) || a.members.some((m) => hit(full(m.first_name, m.last_name)))));
  const athRows = athletes.filter((m) =>
    (!cls || m.classes.some((c) => className(c) === cls)) &&
    hit(full(m.first_name, m.last_name), full(m.account.first_name, m.account.last_name), m.account.email));
  const shown = tab === 'families' ? famRows.length : athRows.length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[['Families', accounts.length], ['Athletes', athletes.length], ['Athletes in a class', inClass], ['Classes', classList.length]].map(([l, n]) => (
          <div key={l} className="card p-4"><div className="text-sm font-semibold text-slate-brand">{l}</div><div className="mt-1 font-display text-4xl leading-none text-navy tabular-nums">{n}</div></div>
        ))}
      </div>

      <div className="border-b border-[#e3e7ee]">
        <div role="tablist" className="flex gap-6">
          {(['families', 'athletes'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setLimit(100); }}
              className={`relative pb-3 text-sm font-semibold capitalize ${tab === t ? 'text-navy' : 'text-slate-brand hover:text-navy'}`}>
              {t} <span className="ml-1 rounded-md bg-[#e9edf3] px-1.5 py-0.5 text-[11px] text-[#3b4658]">{t === 'families' ? accounts.length : athletes.length}</span>
              {tab === t && <span className="absolute inset-x-0 -bottom-px h-[3px] rounded-t bg-navy" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a95a6]" />
          <input id="people-search" aria-label="Search people" className="input py-2.5 pl-9" placeholder="Search name, email or phone" value={q} onChange={(e) => { setQ(e.target.value); setLimit(100); }} />
        </label>
        <select id="people-class" aria-label="Filter by class" className="input w-auto py-2.5" value={cls} onChange={(e) => { setCls(e.target.value); setLimit(100); }}>
          <option value="">All classes</option>
          {classList.map(([n, c]) => <option key={n} value={n}>{n} ({c})</option>)}
        </select>
        <span className="text-sm text-slate-brand"><strong className="text-[#1b2433]">{shown}</strong> {tab}</span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          {tab === 'families' ? (
            <table className="w-full text-sm">
              <thead className="border-b border-[#e3e7ee] text-left text-[11px] font-bold uppercase tracking-[0.1em] text-slate-brand">
                <tr><th className="py-3.5 pl-5 pr-3">Family</th><th className="px-3 py-3.5">Contact</th><th className="px-3 py-3.5">Athletes</th><th className="px-3 py-3.5">Texts</th><th className="w-10" /></tr>
              </thead>
              <tbody className="divide-y divide-[#edf0f4]">
                {famRows.slice(0, limit).map((a) => (
                  <tr key={a.id} className="hover:bg-[#f8f9fc]">
                    <td className="py-3 pl-5 pr-3">
                      <Link href={`/${slug}/people/${a.id}`} className="flex items-center gap-3">
                        <Avatar name={full(a.first_name, a.last_name) || '?'} />
                        <span className="font-semibold text-[#1b2433] hover:text-navy hover:underline">{full(a.first_name, a.last_name) || a.email}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-3"><div className="truncate">{a.email}</div><div className="text-xs text-slate-brand">{a.mobile || a.phone}</div></td>
                    <td className="px-3 py-3">
                      {a.members.length === 0 ? <span className="text-xs text-slate-brand">None</span> : (
                        <div className="flex flex-wrap gap-1.5">{a.members.map((m) => (
                          <span key={m.id} className="chip bg-navy-50 text-navy">{m.first_name}{m.birthday ? ` · ${ageOn(m.birthday, today).replace(' yrs', '')}` : ''}</span>
                        ))}</div>
                      )}
                    </td>
                    <td className="px-3 py-3"><SmsChip status={a.sms_status} /></td>
                    <td className="pr-4"><Link href={`/${slug}/people/${a.id}`} aria-label="Open family" className="grid h-8 w-8 place-items-center rounded-lg text-[#9aa4b4] hover:text-navy"><ChevronRight className="h-4 w-4" /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[#e3e7ee] text-left text-[11px] font-bold uppercase tracking-[0.1em] text-slate-brand">
                <tr><th className="py-3.5 pl-5 pr-3">Athlete</th><th className="px-3 py-3.5">Age</th><th className="px-3 py-3.5">Classes</th><th className="px-3 py-3.5">Family</th><th className="w-10" /></tr>
              </thead>
              <tbody className="divide-y divide-[#edf0f4]">
                {athRows.slice(0, limit).map((m) => (
                  <tr key={m.id} className="hover:bg-[#f8f9fc]">
                    <td className="py-3 pl-5 pr-3"><Link href={`/${slug}/people/${m.account.id}#m-${m.id}`} className="flex items-center gap-3"><Avatar name={full(m.first_name, m.last_name)} /><span className="font-semibold hover:text-navy hover:underline">{full(m.first_name, m.last_name)}</span></Link></td>
                    <td className="px-3 py-3 tabular-nums">{ageOn(m.birthday, today) || '—'}</td>
                    <td className="px-3 py-3">{m.classes.length ? <div className="flex flex-wrap gap-1.5">{[...new Set(m.classes.map(className))].map((c) => <span key={c} className="chip bg-[#eef6f5] text-[#2c7a73]">{c}</span>)}</div> : <span className="text-xs text-slate-brand">Not in a class</span>}</td>
                    <td className="px-3 py-3"><Link href={`/${slug}/people/${m.account.id}`} className="hover:text-navy hover:underline">{full(m.account.first_name, m.account.last_name)}</Link><div className="text-xs text-slate-brand">{m.account.mobile || m.account.phone}</div></td>
                    <td className="pr-4"><Link href={`/${slug}/people/${m.account.id}#m-${m.id}`} aria-label="Open athlete" className="grid h-8 w-8 place-items-center rounded-lg text-[#9aa4b4] hover:text-navy"><ChevronRight className="h-4 w-4" /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {shown > limit && (
          <div className="border-t border-[#edf0f4] p-3 text-center">
            <button className="btn-ghost rounded-xl" onClick={() => setLimit(limit + 200)}>Show more ({shown - limit} left)</button>
          </div>
        )}
        {shown === 0 && <p className="p-8 text-center text-sm text-slate-brand">No matches.</p>}
      </div>
    </div>
  );
}

export function SmsChip({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-slate-brand">—</span>;
  const s = status.toLowerCase();
  const cls = s === 'stopped' ? 'bg-red-50 text-red-700' : s === 'verified' ? 'bg-[#e3f3e9] text-stage-won' : 'bg-[#eef1f6] text-slate-brand';
  return <span className={`chip ${cls}`}>{s === 'stopped' ? 'Opted out' : status}</span>;
}

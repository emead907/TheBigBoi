'use client';
import Link from 'next/link';
import { useMemo, useOptimistic, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addDays, formatDay } from '@/lib/dates';
import { BLOCKED_PARTY_DATES, PARTY_SLOTS, PARTY_STAGES, balance, conflicts, money, type Party, type PartyStage } from '@/lib/parties';
import { deleteParty, updateParty, type PartyPatch } from '@/app/[gym]/parties/actions';
import { Avatar, CheckBox, PageHeader } from './ui';
import { ChevronRight, Plus, Search, Trash } from './icons';

type Row = Party & { stage: PartyStage };
const DOT: Record<PartyStage, string> = { inquiry: 'bg-stage-new', upcoming: 'bg-[#d64f8a]', past: 'bg-stage-won', closed: 'bg-stage-lost' };

export default function PartyBoard({ slug, today, timezone, parties, initialStage, canDelete }: {
  slug: string; today: string; timezone: string; parties: Row[]; initialStage: PartyStage; canDelete: boolean;
}) {
  const router = useRouter();
  const [stage, setStage] = useState(initialStage);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [, start] = useTransition();
  const [rows, apply] = useOptimistic(parties, (s, u: { id: string; patch?: PartyPatch; remove?: boolean }) =>
    u.remove ? s.filter((p) => p.id !== u.id) : s.map((p) => (p.id === u.id ? ({ ...p, ...u.patch } as Row) : p)));

  const counts = useMemo(() => {
    const c: Record<PartyStage, number> = { inquiry: 0, upcoming: 0, past: 0, closed: 0 };
    parties.forEach((p) => c[p.stage]++);
    return c;
  }, [parties]);

  const needle = q.trim().toLowerCase();
  const visible = rows
    .filter((p) => (needle ? [p.parent_name, p.child_name, p.parent_email, p.parent_phone, p.theme].some((v) => v?.toLowerCase().includes(needle)) : p.stage === stage))
    .sort((a, b) => stage === 'past' ? (b.party_date ?? '').localeCompare(a.party_date ?? '') : (a.party_date ?? '9999').localeCompare(b.party_date ?? '9999'));

  function save(id: string, patch: PartyPatch) {
    setError('');
    start(async () => { apply({ id, patch }); const r = await updateParty(slug, id, patch); if (!r.ok) setError(r.error); router.refresh(); });
  }
  function remove(p: Row) {
    if (!window.confirm(`Delete the party for ${p.child_name || p.parent_name}? Use this for tests or spam. It can't be undone.`)) return;
    start(async () => { apply({ id: p.id, remove: true }); const r = await deleteParty(slug, p.id, { stay: true }); if (!r.ok) setError(r.error); router.refresh(); });
  }
  const stamp = (on: boolean) => (on ? new Date().toISOString() : null);

  // Next 8 weekends (Saturday + Sunday), starting with the current one.
  const weeks = useMemo(() => {
    const dow = new Date(today + 'T12:00:00Z').getUTCDay();
    const firstSat = dow === 0 ? addDays(today, -1) : addDays(today, 6 - dow);
    return Array.from({ length: 8 }, (_, i) => {
      const sat = addDays(firstSat, i * 7);
      return [{ date: sat, day: 'Saturday' as const }, { date: addDays(sat, 1), day: 'Sunday' as const }].filter((d) => d.date >= today);
    });
  }, [today]);
  const bookedAt = (date: string, slot: string) => rows.find((p) => p.status === 'booked' && p.party_date === date && p.time_slot === slot);
  const heldAt = (date: string, slot: string) => rows.find((p) => p.status === 'inquiry' && p.party_date === date && p.time_slot === slot);

  const month = today.slice(0, 7);
  const bookedThisMonth = rows.filter((p) => p.status === 'booked' || p.status === 'completed').filter((p) => p.party_date?.startsWith(month));
  const decided = rows.filter((p) => p.status !== 'inquiry');
  const bookRate = decided.length ? decided.filter((p) => p.status === 'booked' || p.status === 'completed').length / decided.length : null;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Birthday parties" title="Parties" subtitle="Party requests, bookings and the weekend calendar."
        right={<Link href={`/${slug}/parties/new`} className="btn-primary rounded-xl px-4 py-2.5"><Plus className="h-4 w-4" />Add party</Link>} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['New inquiries', String(counts.inquiry)],
          ['Booked, coming up', String(counts.upcoming)],
          ['Parties this month', String(bookedThisMonth.length)],
          ['Booking rate', bookRate == null ? '—' : `${Math.round(bookRate * 100)}%`],
        ].map(([l, v]) => (
          <div key={l} className="card p-4"><div className="text-sm font-semibold text-slate-brand">{l}</div><div className="mt-1 font-display text-4xl leading-none text-navy tabular-nums">{v}</div></div>
        ))}
      </div>

      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div><div className="eyebrow text-[10px]">Next 8 weekends</div><h2 className="display text-[26px] leading-none">Party calendar</h2></div>
          <div className="flex gap-4 text-xs text-slate-brand">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#d64f8a]" />Booked</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-dashed border-[#d64f8a] bg-white" />Requested</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#e3f3e9]" />Open</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#eef0f3]" />No parties</span>
          </div>
        </div>
        <div className="-mx-1 overflow-x-auto pb-1">
          <div className="grid min-w-[760px] grid-cols-8 gap-2 px-1">
            {weeks.map((pair, w) => (
              <div key={w} className="space-y-2">
                {pair.map((d) => (
                  <div key={d.date} className="rounded-lg border border-[#e3e7ee] p-2">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-brand">{formatDay(d.date)}</div>
                    {BLOCKED_PARTY_DATES[d.date] && !rows.some((p) => p.status === 'booked' && p.party_date === d.date) ? (
                      <div className="mt-1.5 rounded bg-[#eef0f3] px-1.5 py-2.5 text-center text-[11px] font-semibold text-[#5b6472]">No parties<br /><span className="font-normal">{BLOCKED_PARTY_DATES[d.date]}</span></div>
                    ) : (
                    <div className="mt-1.5 space-y-1">
                      {PARTY_SLOTS[d.day].map((slot) => {
                        const b = bookedAt(d.date, slot); const h = !b && heldAt(d.date, slot);
                        const label = slot.split('–')[0].trim();
                        return b ? (
                          <Link key={slot} href={`/${slug}/parties/${b.id}`} title={`${slot}: ${b.child_name || b.parent_name}`} className="block truncate rounded bg-[#d64f8a] px-1.5 py-1 text-[11px] font-semibold text-white">{label} · {b.child_name || b.parent_name}</Link>
                        ) : h ? (
                          <Link key={slot} href={`/${slug}/parties/${h.id}`} title={`${slot}: requested by ${h.parent_name}`} className="block truncate rounded border-2 border-dashed border-[#d64f8a] px-1.5 py-0.5 text-[11px] font-semibold text-[#b03a6f]">{label} · ?</Link>
                        ) : (
                          <div key={slot} className="rounded bg-[#e3f3e9] px-1.5 py-1 text-[11px] font-semibold text-stage-won">{label} · Open</div>
                        );
                      })}
                    </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="-mx-4 overflow-x-auto border-b border-[#e3e7ee] px-4 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Party stages" className="flex min-w-max gap-6">
          {PARTY_STAGES.map((s) => {
            const on = stage === s.key && !needle;
            return (
              <button key={s.key} role="tab" aria-selected={on} onClick={() => { setStage(s.key); setQ(''); router.replace(`/${slug}/parties?stage=${s.key}`, { scroll: false }); }}
                className={`relative flex items-center gap-2 pb-3 pt-1 text-sm font-semibold ${on ? 'text-navy' : 'text-slate-brand hover:text-navy'}`}>
                <span className={`h-2 w-2 rounded-full ${DOT[s.key]}`} />{s.label}
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
          <input id="party-search" aria-label="Search parties" className="input py-2.5 pl-9" placeholder="Search parent, child or theme" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <span className="text-sm text-slate-brand">{needle ? `${visible.length} matches in every stage` : PARTY_STAGES.find((s) => s.key === stage)?.hint}</span>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {visible.length === 0 ? (
        <div className="card p-12 text-center"><div className="display text-2xl">{needle ? 'No matches' : 'Nothing here'}</div></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[#e3e7ee] text-left text-[11px] font-bold uppercase tracking-[0.1em] text-slate-brand">
                <tr>
                  <th className="py-3.5 pl-5 pr-3">Party</th><th className="px-3 py-3.5">Date & time</th><th className="px-3 py-3.5">Parent</th>
                  <th className="px-3 py-3.5">Kids</th><th className="px-3 py-3.5">Price</th>
                  <th className="px-3 py-3.5 text-center">Contacted</th><th className="px-3 py-3.5 text-center">Paid</th><th className="px-3 py-3.5 text-center">Confirmed</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0f4]">
                {visible.map((p) => {
                  const clash = conflicts(p, rows).length > 0;
                  const late = p.stage === 'inquiry' && !p.contacted_at && Date.now() - Date.parse(p.received_at) > 86_400_000;
                  return (
                    <tr key={p.id} className={`group ${late ? 'bg-[#fdf1f1]' : 'hover:bg-[#f8f9fc]'}`}>
                      <td className={`py-3.5 pl-5 pr-3 border-l-[3px] ${late ? 'border-red-500' : 'border-transparent'}`}>
                        <Link href={`/${slug}/parties/${p.id}`} className="flex items-center gap-3">
                          <Avatar name={p.child_name || p.parent_name || '?'} />
                          <div>
                            <div className="font-semibold hover:text-navy hover:underline">{p.child_name ? `${p.child_name}'s party` : `${p.parent_name ?? 'Party'}`}</div>
                            <div className="text-xs text-slate-brand">{[p.child_age && `Turning ${p.child_age}`, p.theme].filter(Boolean).join(' · ') || (p.package === 'gym_only' ? 'Gym only' : 'Party room')}</div>
                            {late && <div className="text-[10px] font-bold uppercase tracking-wider text-red-600">Needs a reply</div>}
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="font-semibold">{p.party_date ? formatDay(p.party_date) : '—'}</div>
                        <div className="text-xs text-slate-brand">{p.time_slot}</div>
                        {clash && <div className="text-[10px] font-bold uppercase tracking-wider text-red-600">Slot already booked</div>}
                        {p.party_date && BLOCKED_PARTY_DATES[p.party_date] && p.stage !== 'past' && p.stage !== 'closed' && <div className="text-[10px] font-bold uppercase tracking-wider text-red-600">No-party day: {BLOCKED_PARTY_DATES[p.party_date]}</div>}
                      </td>
                      <td className="px-3 py-3.5"><div className="font-semibold">{p.parent_name}</div><div className="text-xs text-slate-brand">{p.parent_phone}</div></td>
                      <td className="px-3 py-3.5 tabular-nums">{p.num_children ?? '—'}</td>
                      <td className="px-3 py-3.5 tabular-nums"><div className="font-semibold">{money(p.total_price)}</div>{p.total_price != null && balance(p) > 0 && <div className="text-xs text-[#9a5a12]">{money(balance(p))} due</div>}</td>
                      <td className="px-3 py-3.5 text-center"><CheckBox label="Contacted" checked={!!p.contacted_at} onChange={(v) => save(p.id, { contacted_at: stamp(v) })} /></td>
                      <td className="px-3 py-3.5 text-center"><CheckBox label="Paid" checked={!!p.paid_at} onChange={(v) => save(p.id, v ? { paid_at: stamp(true), amount_paid: p.total_price ?? p.amount_paid, status: p.status === 'inquiry' ? 'booked' : p.status } : { paid_at: null })} /></td>
                      <td className="px-3 py-3.5 text-center"><CheckBox label="Confirmation sent" checked={!!p.confirmed_at} onChange={(v) => save(p.id, { confirmed_at: stamp(v) })} /></td>
                      <td className="pr-4">
                        <div className="flex items-center justify-end gap-1">
                          {canDelete && <button type="button" onClick={() => remove(p)} aria-label="Delete party" className="grid h-8 w-8 place-items-center rounded-lg text-[#b6bfcc] opacity-0 hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"><Trash className="h-4 w-4" /></button>}
                          <Link href={`/${slug}/parties/${p.id}`} aria-label="Open party" className="grid h-8 w-8 place-items-center rounded-lg text-[#9aa4b4] hover:text-navy"><ChevronRight className="h-4 w-4" /></Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="text-xs text-slate-brand">Checking <strong>Paid</strong> books the party. Policy: full cost due upfront; all but $50 refundable if cancelled 24+ hours before.</p>
    </div>
  );
}

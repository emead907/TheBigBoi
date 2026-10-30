'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ADD_ONS, BASE_PRICE, BLOCKED_PARTY_DATES, NON_REFUNDABLE, PARTY_SLOTS, balance, dayName, money, type Party } from '@/lib/parties';
import { deleteParty, updateParty, type PartyPatch } from '@/app/[gym]/parties/actions';
import { Card, CheckBox } from './ui';
import { Trash } from './icons';

const STATUSES: [Party['status'], string][] = [['inquiry', 'Inquiry'], ['booked', 'Booked'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['not_booked', 'Not booked']];

export default function PartyEditor({ slug, party, isOwner }: { slug: string; party: Party; isOwner: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [f, setF] = useState({
    parent_name: party.parent_name ?? '', parent_email: party.parent_email ?? '', parent_phone: party.parent_phone ?? '',
    child_name: party.child_name ?? '', child_age: party.child_age ?? '', party_date: party.party_date ?? '', time_slot: party.time_slot ?? '',
    num_children: party.num_children?.toString() ?? '', children_ages: party.children_ages ?? '', theme: party.theme ?? '',
    package: party.package, add_ons: party.add_ons ?? [], total_price: party.total_price?.toString() ?? '', amount_paid: String(party.amount_paid ?? 0),
    coach: party.coach ?? '', notes: party.notes ?? '',
  });
  const save = (patch: PartyPatch, ok = 'Saved.') => { setMsg(null); start(async () => { const r = await updateParty(slug, party.id, patch); setMsg(r.ok ? { ok: true, text: ok } : { ok: false, text: r.error }); router.refresh(); }); };
  const stamp = (on: boolean) => (on ? new Date().toISOString() : null);
  const day = dayName(f.party_date);
  const slots = day ? PARTY_SLOTS[day] : [];
  const field = (k: keyof typeof f, label: string, type = 'text', extra: Record<string, string> = {}) => (
    <div>
      <label htmlFor={`p-${k}`} className="label text-[10px]">{label}</label>
      <input id={`p-${k}`} type={type} className="input" value={f[k] as string} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} />
    </div>
  );
  const n = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v));

  return (
    <div className="min-w-0 space-y-5">
      <Card eyebrow="Next steps" title="Checklist" action={
        <label className="flex items-center gap-2"><span className="eyebrow">Status</span>
          <select id="p-status" className="input h-10 w-40 font-semibold" value={party.status} disabled={pending} onChange={(e) => save({ status: e.target.value as Party['status'] })}>
            {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></label>}>
        <ul className="grid gap-3 sm:grid-cols-3">
          {([
            ['contacted_at', 'Contacted the family', 'Confirm date, time and headcount'],
            ['paid_at', 'Paid in full', `Booking is held once paid. $${NON_REFUNDABLE} is non-refundable.`],
            ['confirmed_at', 'Confirmation sent', 'Date, time, what to bring, waiver link'],
          ] as const).map(([k, l, sub]) => (
            <li key={k}>
              <label htmlFor={`c-${k}`} className={`flex h-full cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 ${party[k] ? 'border-[#cfe5d7] bg-[#f5fbf7]' : 'border-[#e3e7ee]'}`}>
                <CheckBox id={`c-${k}`} label={l} checked={!!party[k]} disabled={pending}
                  onChange={(v) => save(k === 'paid_at' && v
                    ? { paid_at: stamp(true), amount_paid: n(f.total_price) ?? party.amount_paid, status: party.status === 'inquiry' ? 'booked' : party.status }
                    : { [k]: stamp(v) } as PartyPatch, k === 'paid_at' && v ? 'Marked paid. The party is booked.' : 'Saved.')} />
                <span><span className="block text-sm font-semibold">{l}</span><span className="block text-xs text-slate-brand">{sub}</span></span>
              </label>
            </li>
          ))}
        </ul>
        {msg && <p role="status" className={`mt-3 text-sm ${msg.ok ? 'text-stage-won' : 'text-red-700'}`}>{msg.text}</p>}
      </Card>

      <Card eyebrow="When" title="Date & time">
        <div className="grid gap-3 sm:grid-cols-3">
          {field('party_date', 'Party date', 'date')}
          <div>
            <label htmlFor="p-time_slot" className="label text-[10px]">Time</label>
            <select id="p-time_slot" className="input" value={f.time_slot} onChange={(e) => setF({ ...f, time_slot: e.target.value })}>
              <option value="">{slots.length ? 'Choose a time' : f.party_date ? 'Not a Saturday or Sunday' : 'Pick a date first'}</option>
              {[...new Set([...slots, ...(f.time_slot ? [f.time_slot] : [])])].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {field('coach', 'Coach', 'text', { placeholder: 'Who’s running it' })}
        </div>
        {f.party_date && BLOCKED_PARTY_DATES[f.party_date] && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{new Date(f.party_date + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })} is a no-party day ({BLOCKED_PARTY_DATES[f.party_date]}).</p>}
        <button className="btn-ghost mt-3 rounded-xl" disabled={pending}
          onClick={() => save({ party_date: f.party_date || null, time_slot: f.time_slot || null, coach: f.coach || null })}>Save date & coach</button>
      </Card>

      <Card eyebrow="Details" title="Party & family">
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save({
          parent_name: f.parent_name || null, parent_email: f.parent_email || null, parent_phone: f.parent_phone || null,
          child_name: f.child_name || null, child_age: f.child_age || null, num_children: n(f.num_children), children_ages: f.children_ages || null,
          theme: f.theme || null, package: f.package, add_ons: f.add_ons,
        }, 'Details saved.'); }}>
          {field('parent_name', 'Parent')}{field('parent_phone', 'Phone', 'tel')}
          {field('parent_email', 'Email', 'email')}{field('child_name', 'Birthday child')}
          {field('child_age', 'Turning')}{field('num_children', 'Number of kids', 'number', { min: '0' })}
          {field('children_ages', 'Guest ages')}{field('theme', 'Theme')}
          <fieldset className="sm:col-span-2">
            <legend className="label text-[10px]">Package</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              {([['party_room', '60 min gym + 30 min party room'], ['gym_only', '90 min gym, no party room']] as const).map(([v, l]) => (
                <label key={v} htmlFor={`pk-${v}`} className="flex items-center gap-2"><input id={`pk-${v}`} type="radio" name="package" className="accent-navy" checked={f.package === v} onChange={() => setF({ ...f, package: v })} />{l}</label>
              ))}
            </div>
          </fieldset>
          <fieldset className="sm:col-span-2">
            <legend className="label text-[10px]">Add-ons</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {ADD_ONS.map((a) => (
                <label key={a} htmlFor={`ao-${a}`} className="flex items-center gap-2"><input id={`ao-${a}`} type="checkbox" className="h-4 w-4 accent-navy" checked={f.add_ons.includes(a)}
                  onChange={(e) => setF({ ...f, add_ons: e.target.checked ? [...f.add_ons, a] : f.add_ons.filter((x) => x !== a) })} />{a}</label>
              ))}
            </div>
          </fieldset>
          <div className="sm:col-span-2"><button className="btn-primary rounded-xl" disabled={pending}>Save details</button></div>
        </form>
      </Card>

      <Card eyebrow="Payment" title="Price & payment">
        <div className="grid gap-3 sm:grid-cols-3">
          {field('total_price', 'Total price', 'number', { min: '0', step: '0.01', placeholder: String(BASE_PRICE) })}
          {field('amount_paid', 'Amount paid', 'number', { min: '0', step: '0.01' })}
          <div><div className="label text-[10px]">Balance</div><div className="pt-2 font-display text-3xl leading-none text-navy">{money(balance({ total_price: n(f.total_price), amount_paid: n(f.amount_paid) ?? 0 }))}</div></div>
        </div>
        <p className="mt-2 text-xs text-slate-brand">Base package is {money(BASE_PRICE)} for up to 10 kids. Full cost is due upfront; all but {money(NON_REFUNDABLE)} is refundable if cancelled 24+ hours before.</p>
        <button className="btn-ghost mt-3 rounded-xl" disabled={pending} onClick={() => save({ total_price: n(f.total_price), amount_paid: n(f.amount_paid) ?? 0 })}>Save payment</button>
      </Card>

      <Card eyebrow="Staff only" title="Notes">
        <textarea id="p-notes" aria-label="Notes" rows={4} className="input rounded-xl" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Allergies, cake time, setup requests…" />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className="btn-ghost rounded-xl" disabled={pending || f.notes === (party.notes ?? '')} onClick={() => save({ notes: f.notes || null }, 'Notes saved.')}>Save notes</button>
          {isOwner && (
            <button type="button" className="btn-danger ml-auto rounded-xl" disabled={pending}
              onClick={() => { if (window.confirm('Delete this party? Use this for tests or spam. It can’t be undone.')) start(async () => { await deleteParty(slug, party.id); }); }}>
              <Trash className="h-4 w-4" />Delete
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}

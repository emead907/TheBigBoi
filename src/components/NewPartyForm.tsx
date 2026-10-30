'use client';
import { useState, useTransition } from 'react';
import { createParty } from '@/app/[gym]/parties/actions';
import { ADD_ONS, BASE_PRICE, PARTY_SLOTS, dayName } from '@/lib/parties';
import { Card } from './ui';

export default function NewPartyForm({ slug }: { slug: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [date, setDate] = useState('');
  const day = dayName(date);
  const input = (name: string, label: string, type = 'text', extra: Record<string, string> = {}) => (
    <div><label htmlFor={`np-${name}`} className="label text-[10px]">{label}</label><input id={`np-${name}`} name={name} type={type} className="input" {...extra} /></div>
  );
  return (
    <Card>
      <form className="grid gap-3 sm:grid-cols-2" action={(fd) => start(async () => { setError(''); const r = await createParty(slug, fd); if (r && !r.ok) setError(r.error); })}>
        {input('parent_name', 'Parent', 'text', { required: 'true' })}{input('parent_phone', 'Phone', 'tel')}
        {input('parent_email', 'Email', 'email')}{input('child_name', 'Birthday child')}
        {input('child_age', 'Turning')}{input('num_children', 'Number of kids', 'number', { min: '0' })}
        <div><label htmlFor="np-party_date" className="label text-[10px]">Party date</label><input id="np-party_date" name="party_date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div>
          <label htmlFor="np-time_slot" className="label text-[10px]">Time</label>
          <select id="np-time_slot" name="time_slot" className="input" disabled={!day} defaultValue="" key={date}>
            <option value="">{day ? 'Choose a time' : date ? 'Not a Saturday or Sunday' : 'Pick a date first'}</option>
            {(day ? PARTY_SLOTS[day] : []).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {input('theme', 'Theme')}{input('total_price', 'Total price', 'number', { min: '0', step: '0.01', placeholder: String(BASE_PRICE) })}
        <fieldset className="sm:col-span-2">
          <legend className="label text-[10px]">Add-ons</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">{ADD_ONS.map((a) => <label key={a} htmlFor={`na-${a}`} className="flex items-center gap-2"><input id={`na-${a}`} name="add_ons" value={a} type="checkbox" className="h-4 w-4 accent-navy" />{a}</label>)}</div>
        </fieldset>
        <div>
          <label htmlFor="np-source" className="label text-[10px]">How did they reach us?</label>
          <select id="np-source" name="source" className="input" defaultValue="phone"><option value="phone">Phone call</option><option value="email">Email</option><option value="walk_in">Walk-in</option><option value="manual">Other</option></select>
        </div>
        <label htmlFor="np-booked" className="flex items-end gap-2 pb-2 text-sm"><input id="np-booked" name="booked" type="checkbox" className="h-4 w-4 accent-navy" /> Already paid and booked</label>
        <div className="sm:col-span-2"><label htmlFor="np-notes" className="label text-[10px]">Notes</label><textarea id="np-notes" name="notes" rows={2} className="input" /></div>
        {error && <p className="text-sm text-red-700 sm:col-span-2">{error}</p>}
        <div className="sm:col-span-2"><button className="btn-primary rounded-xl" disabled={pending}>{pending ? 'Saving…' : 'Add party'}</button></div>
      </form>
    </Card>
  );
}

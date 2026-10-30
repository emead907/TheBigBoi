'use client';
import { useState, useTransition } from 'react';
import { createParty } from '@/app/[gym]/parties/actions';
import { ADD_ONS, BASE_PRICE, PARTY_SLOTS, dayName, parsePartyEmail } from '@/lib/parties';
import { Card } from './ui';

const blank = {
  parent_name: '', parent_phone: '', parent_email: '', child_name: '', child_age: '', num_children: '',
  party_date: '', time_slot: '', theme: '', children_ages: '', total_price: '', notes: '', comments: '', source: 'phone',
};

export default function NewPartyForm({ slug }: { slug: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [paste, setPaste] = useState('');
  const [f, setF] = useState(blank);
  const [addOns, setAddOns] = useState<string[]>([]);
  const day = dayName(f.party_date);
  const slots = day ? PARTY_SLOTS[day] : [];

  function fill() {
    const p = parsePartyEmail(paste);
    setF({ ...f, parent_name: p.parent_name, parent_email: p.parent_email, parent_phone: p.parent_phone, party_date: p.party_date,
      time_slot: p.time_slot, num_children: p.num_children, children_ages: p.children_ages, theme: p.theme,
      child_age: p.child_age || f.child_age, comments: p.comments, source: 'website' });
    setAddOns(p.add_ons.filter((a) => ADD_ONS.includes(a)));
  }

  const input = (k: keyof typeof blank, label: string, type = 'text', extra: Record<string, string> = {}) => (
    <div>
      <label htmlFor={`np-${k}`} className="label text-[10px]">{label}</label>
      <input id={`np-${k}`} name={k} type={type} className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} />
    </div>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.5fr]">
      <Card eyebrow="Optional" title="Paste a party request email">
        <textarea id="party-paste" aria-label="Party request email" rows={14} className="input font-mono text-xs" value={paste} onChange={(e) => setPaste(e.target.value)}
          placeholder={'Requested by: …\nEmail: …\nPhone: …\n\nDate: 2026-12-13\nStart time: 11:00 AM – 12:30 PM\nKids attending: 10\nAges: 7-10\nTheme: …\nAdd-ons: …\n\nComments: …'} />
        <button type="button" className="btn-ghost mt-2 rounded-xl" disabled={!paste.trim()} onClick={fill}>Fill in the form →</button>
      </Card>

      <Card>
        <form className="grid gap-3 sm:grid-cols-2" action={(fd) => start(async () => { setError(''); const r = await createParty(slug, fd); if (r && !r.ok) setError(r.error); })}>
          {input('parent_name', 'Parent', 'text', { required: 'true' })}{input('parent_phone', 'Phone', 'tel')}
          {input('parent_email', 'Email', 'email')}{input('child_name', 'Birthday child')}
          {input('child_age', 'Turning')}{input('num_children', 'Number of kids', 'number', { min: '0' })}
          {input('party_date', 'Party date', 'date')}
          <div>
            <label htmlFor="np-time_slot" className="label text-[10px]">Time</label>
            <select id="np-time_slot" name="time_slot" className="input" value={f.time_slot} onChange={(e) => setF({ ...f, time_slot: e.target.value })}>
              <option value="">{day ? 'Choose a time' : f.party_date ? 'Not a Saturday or Sunday' : 'Pick a date first'}</option>
              {[...new Set([...slots, ...(f.time_slot ? [f.time_slot] : [])])].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {input('children_ages', 'Guest ages')}{input('theme', 'Theme')}
          {input('total_price', 'Total price', 'number', { min: '0', step: '0.01', placeholder: String(BASE_PRICE) })}
          <div>
            <label htmlFor="np-source" className="label text-[10px]">How did they reach us?</label>
            <select id="np-source" name="source" className="input" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
              <option value="website">Website</option><option value="phone">Phone call</option><option value="email">Email</option><option value="walk_in">Walk-in</option><option value="manual">Other</option>
            </select>
          </div>
          <fieldset className="sm:col-span-2">
            <legend className="label text-[10px]">Add-ons</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">{ADD_ONS.map((a) => (
              <label key={a} htmlFor={`na-${a}`} className="flex items-center gap-2"><input id={`na-${a}`} name="add_ons" value={a} type="checkbox" className="h-4 w-4 accent-navy"
                checked={addOns.includes(a)} onChange={(e) => setAddOns(e.target.checked ? [...addOns, a] : addOns.filter((x) => x !== a))} />{a}</label>
            ))}</div>
          </fieldset>
          <div className="sm:col-span-2">{input('comments', 'Family’s comments')}</div>
          <label htmlFor="np-booked" className="flex items-center gap-2 text-sm sm:col-span-2"><input id="np-booked" name="booked" type="checkbox" className="h-4 w-4 accent-navy" /> Already paid and booked</label>
          <div className="sm:col-span-2"><label htmlFor="np-notes" className="label text-[10px]">Staff notes</label><textarea id="np-notes" name="notes" rows={2} className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          {error && <p className="text-sm text-red-700 sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2"><button className="btn-primary rounded-xl" disabled={pending}>{pending ? 'Saving…' : 'Add party'}</button></div>
        </form>
      </Card>
    </div>
  );
}

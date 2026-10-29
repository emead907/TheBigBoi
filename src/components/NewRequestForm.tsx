'use client';
import { useState, useTransition } from 'react';
import { createTrials } from '@/app/[gym]/actions';
import { parseRequestEmail } from '@/lib/parse';

type Kid = { child_name: string; birthday: string; first_day: string };
const blankKid: Kid = { child_name: '', birthday: '', first_day: '' };

export default function NewRequestForm({ slug }: { slug: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [paste, setPaste] = useState('');
  const [f, setF] = useState({ class_name: '', requested_time: '', parent_name: '', parent_email: '', parent_phone: '', zip: '', notes: '', source: 'manual' });
  const [kids, setKids] = useState<Kid[]>([{ ...blankKid }]);

  function fillFromPaste() {
    const p = parseRequestEmail(paste);
    setF({ ...f, class_name: p.class_name, requested_time: p.requested_time, parent_name: p.parent_name,
      parent_email: p.parent_email, parent_phone: p.parent_phone, zip: p.zip, source: 'email' });
    if (p.children.length) setKids(p.children.map((c) => ({ child_name: c.child_name, birthday: c.birthday ?? '', first_day: '' })));
  }

  const field = (k: keyof typeof f, label: string, type = 'text') => (
    <div>
      <label htmlFor={`n-${k}`} className="label">{label}</label>
      <input id={`n-${k}`} name={k} type={type} className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </div>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
      <section className="card p-5">
        <h2 className="display text-2xl">Paste a request email</h2>
        <textarea id="paste" aria-label="Request email" rows={12} className="input mt-3 font-mono text-xs" value={paste}
          onChange={(e) => setPaste(e.target.value)} placeholder={'Class: Shining Stars (Girls Beginner)\nRequested time: Monday at 4:30–5:30 PM\n\nParent: …\nEmail: …\nPhone: …\nZip: …\n\nChild: …\nBirthday: …'} />
        <button type="button" className="btn-ghost mt-2" disabled={!paste.trim()} onClick={fillFromPaste}>Fill in the form →</button>
      </section>

      <form className="card space-y-4 p-5" action={(fd) => start(async () => {
        setError('');
        const res = await createTrials(slug, fd);
        if (res && !res.ok) setError(res.error);
      })}>
        <div className="grid gap-3 sm:grid-cols-2">
          {field('class_name', 'Class')}
          {field('requested_time', 'Requested time')}
          {field('parent_name', 'Parent')}
          {field('parent_phone', 'Phone', 'tel')}
          {field('parent_email', 'Email', 'email')}
          {field('zip', 'Zip')}
        </div>

        <fieldset className="space-y-2">
          <legend className="label">Children</legend>
          {kids.map((k, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-mist p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
              <input name="child_name" aria-label="Child's name" className="input" placeholder="Child's name" required={i === 0}
                value={k.child_name} onChange={(e) => setKids(kids.map((x, j) => (j === i ? { ...x, child_name: e.target.value } : x)))} />
              <input name="birthday" aria-label="Birthday" type="date" className="input" value={k.birthday}
                onChange={(e) => setKids(kids.map((x, j) => (j === i ? { ...x, birthday: e.target.value } : x)))} />
              <input name="first_day" aria-label="First day (optional)" type="date" className="input" title="First day (optional)" value={k.first_day}
                onChange={(e) => setKids(kids.map((x, j) => (j === i ? { ...x, first_day: e.target.value } : x)))} />
              <button type="button" className="btn-ghost" disabled={kids.length === 1} aria-label="Remove child"
                onClick={() => setKids(kids.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <p className="text-xs text-slate-brand">Second date is the first day, if it&apos;s already scheduled.</p>
          <button type="button" className="btn-ghost" onClick={() => setKids([...kids, { ...blankKid }])}>+ Add a sibling</button>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="n-source" className="label">How did they reach us?</label>
            <select id="n-source" name="source" className="input" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
              <option value="manual">Other</option><option value="email">Email</option><option value="phone">Phone call</option>
              <option value="walk_in">Walk-in</option><option value="website">Website</option>
            </select>
          </div>
          <label htmlFor="n-sms" className="flex items-end gap-2 pb-2 text-sm">
            <input id="n-sms" name="sms_opt_in" type="checkbox" className="h-4 w-4 accent-navy" /> Family agreed to texts
          </label>
        </div>
        <div>
          <label htmlFor="n-notes" className="label">Notes</label>
          <textarea id="n-notes" name="notes" rows={2} className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button className="btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Add to board'}</button>
      </form>
    </div>
  );
}

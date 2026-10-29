'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Trial } from '@/lib/types';
import { STATUS_LABEL, type Stage } from '@/lib/stages';
import { deleteTrial, updateTrial, type TrialPatch } from '@/app/[gym]/actions';

export default function TrialEditor({ slug, trial, stage, isOwner }: { slug: string; trial: Trial; stage: Stage; isOwner: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [info, setInfo] = useState({
    child_name: trial.child_name, birthday: trial.birthday ?? '', class_name: trial.class_name ?? '',
    requested_time: trial.requested_time ?? '', parent_name: trial.parent_name ?? '', parent_email: trial.parent_email ?? '',
    parent_phone: trial.parent_phone ?? '', zip: trial.zip ?? '',
  });
  const [notes, setNotes] = useState(trial.notes ?? '');
  const [time, setTime] = useState(trial.first_day_time ?? '');

  function save(patch: TrialPatch, okText = 'Saved.') {
    setMsg(null);
    start(async () => {
      const res = await updateTrial(slug, trial.id, patch);
      setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error });
      router.refresh();
    });
  }
  const stamp = (on: boolean) => (on ? new Date().toISOString() : null);
  const check = (id: string, label: string, checked: boolean, patch: (v: boolean) => TrialPatch) => (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-mist px-3 py-2.5 hover:bg-paper">
      <input id={id} type="checkbox" className="h-5 w-5 accent-navy" checked={checked} disabled={pending}
        onChange={(e) => save(patch(e.target.checked))} />
      <span className="text-sm font-semibold">{label}</span>
    </label>
  );

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <h2 className="display text-2xl">Checklist</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {check('c-se', 'Added to SportsEngine', trial.in_sportsengine, (v) => ({ in_sportsengine: v }))}
          {check('c-spot', 'Spot email sent', !!trial.spot_email_sent_at, (v) => ({ spot_email_sent_at: stamp(v) }))}
          {check('c-call', 'Called the family', !!trial.called_at, (v) => ({ called_at: stamp(v) }))}
          {check('c-fu', 'Followed up after first day', !!trial.followed_up_at, (v) => ({ followed_up_at: stamp(v) }))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="first_day" className="label">First day</label>
            <input id="first_day" type="date" className="input" defaultValue={trial.first_day ?? ''}
              onChange={(e) => save({ first_day: e.target.value || null }, e.target.value ? 'First day set.' : 'First day cleared.')} />
          </div>
          <div>
            <label htmlFor="first_day_time" className="label">Time</label>
            <input id="first_day_time" className="input" placeholder={trial.requested_time ?? '4:30 PM'} value={time}
              onChange={(e) => setTime(e.target.value)} onBlur={() => time !== (trial.first_day_time ?? '') && save({ first_day_time: time || null })} />
          </div>
          <div>
            <label htmlFor="status" className="label">Status</label>
            <select id="status" className="input" value={trial.status} disabled={pending}
              onChange={(e) => save({ status: e.target.value as Trial['status'] })}>
              {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        {(stage === 'today' || stage === 'follow_up' || trial.showed_up != null) && (
          <div className="mt-4">
            <span className="label">Showed up for first day?</span>
            <div className="flex gap-2">
              {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }].map((o) => (
                <button key={o.l} type="button" disabled={pending}
                  onClick={() => save({ showed_up: trial.showed_up === o.v ? null : o.v })}
                  className={`btn ${trial.showed_up === o.v ? (o.v ? 'bg-stage-won text-white' : 'bg-red-600 text-white') : 'border border-mist bg-white text-slate-brand'}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>
        )}
        {msg && <p className={`mt-3 text-sm ${msg.ok ? 'text-stage-won' : 'text-red-700'}`} role="status">{msg.text}</p>}
      </section>

      <section className="card p-5">
        <label htmlFor="notes" className="display block text-2xl">Notes</label>
        <textarea id="notes" rows={4} className="input mt-3" value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Shy at first, loves the trampoline… Mom asked about the Saturday class…" />
        <button className="btn-ghost mt-2" disabled={pending || notes === (trial.notes ?? '')} onClick={() => save({ notes })}>Save notes</button>
      </section>

      <section className="card p-5">
        <h2 className="display text-2xl">Family</h2>
        <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save(info, 'Family details saved.'); }}>
          {([
            ['child_name', 'Child'], ['birthday', 'Birthday', 'date'], ['class_name', 'Class'], ['requested_time', 'Requested time'],
            ['parent_name', 'Parent'], ['parent_email', 'Email', 'email'], ['parent_phone', 'Phone', 'tel'], ['zip', 'Zip'],
          ] as [keyof typeof info, string, string?][]).map(([k, l, type]) => (
            <div key={k}>
              <label htmlFor={`f-${k}`} className="label">{l}</label>
              <input id={`f-${k}`} type={type ?? 'text'} className="input" value={info[k]}
                onChange={(e) => setInfo({ ...info, [k]: e.target.value })} required={k === 'child_name'} />
            </div>
          ))}
          <label htmlFor="f-sms" className="flex items-center gap-2 text-sm sm:col-span-2">
            <input id="f-sms" type="checkbox" className="h-4 w-4 accent-navy" defaultChecked={trial.sms_opt_in}
              onChange={(e) => save({ sms_opt_in: e.target.checked })} />
            Family agreed to receive texts
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button className="btn-primary" disabled={pending}>Save family details</button>
            {trial.parent_phone && <a className="btn-ghost" href={`tel:${trial.parent_phone}`}>Call {trial.parent_phone}</a>}
            {trial.parent_email && <a className="btn-ghost" href={`mailto:${trial.parent_email}`}>Email</a>}
            {isOwner && (
              <button type="button" className="btn-danger ml-auto" disabled={pending}
                onClick={() => { if (window.confirm(`Delete ${trial.child_name}'s request? This can't be undone.`)) start(async () => { await deleteTrial(slug, trial.id); }); }}>
                Delete
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}

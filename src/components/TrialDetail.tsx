'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Trial } from '@/lib/types';
import { STATUS_LABEL } from '@/lib/stages';
import { deleteTrial, updateTrial, type TrialPatch } from '@/app/[gym]/actions';
import { Card, CheckBox } from './ui';
import { Clock, Edit } from './icons';

function useSave(slug: string, id: string) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = (patch: TrialPatch, okText = 'Saved.') => {
    setMsg(null);
    start(async () => {
      const res = await updateTrial(slug, id, patch);
      setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error });
      router.refresh();
    });
  };
  const note = msg && <p role="status" className={`text-xs ${msg.ok ? 'text-stage-won' : 'text-red-700'}`}>{msg.text}</p>;
  return { save, pending, note };
}

export function StatusSelect({ slug, trial }: { slug: string; trial: Trial }) {
  const { save, pending } = useSave(slug, trial.id);
  return (
    <label className="flex items-center gap-3">
      <span className="eyebrow">Status</span>
      <select id="status" className="input h-11 w-48 font-semibold" value={trial.status} disabled={pending}
        onChange={(e) => save({ status: e.target.value as Trial['status'] })}>
        {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

const EditBtn = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-sm font-semibold text-navy hover:underline">
    {on ? 'Done' : <><Edit className="h-3.5 w-3.5" />Edit</>}
  </button>
);

export function FamilyCard({ slug, trial, age }: { slug: string; trial: Trial; age: string }) {
  const { save, pending, note } = useSave(slug, trial.id);
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({
    parent_name: trial.parent_name ?? '', parent_phone: trial.parent_phone ?? '', parent_email: trial.parent_email ?? '',
    child_name: trial.child_name, birthday: trial.birthday ?? '', zip: trial.zip ?? '',
  });
  const router = useRouter();
  const [deleting, startDelete] = useTransition();

  const item = (label: string, value: React.ReactNode) => (
    <div className="min-w-0"><div className="eyebrow text-[10px]">{label}</div><div className="mt-0.5 truncate text-sm font-semibold">{value || '—'}</div></div>
  );

  return (
    <Card eyebrow="Contact details" title="Family information" action={<EditBtn on={editing} onClick={() => setEditing(!editing)} />}>
      {!editing ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          {item('Parent / guardian', trial.parent_name)}
          {item('Phone', trial.parent_phone ? <a className="text-navy hover:underline" href={`tel:${trial.parent_phone}`}>{trial.parent_phone}</a> : null)}
          {item('Email', trial.parent_email ? <a className="text-navy hover:underline" href={`mailto:${trial.parent_email}`}>{trial.parent_email}</a> : null)}
          {item('Child', `${trial.child_name}${age ? ` · Age ${age.replace(' yrs', '')}` : ''}`)}
          <label htmlFor="sms" className="col-span-2 flex items-center gap-2 text-xs text-slate-brand">
            <input id="sms" type="checkbox" className="h-4 w-4 accent-navy" defaultChecked={trial.sms_opt_in} disabled={pending}
              onChange={(e) => save({ sms_opt_in: e.target.checked })} />
            Family agreed to receive texts
          </label>
        </div>
      ) : (
        <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); save(f, 'Family details saved.'); setEditing(false); }}>
          {([['parent_name', 'Parent'], ['parent_phone', 'Phone', 'tel'], ['parent_email', 'Email', 'email'], ['child_name', 'Child'], ['birthday', 'Birthday', 'date'], ['zip', 'Zip']] as [keyof typeof f, string, string?][])
            .map(([k, l, type]) => (
              <div key={k}>
                <label htmlFor={`fam-${k}`} className="label text-[10px]">{l}</label>
                <input id={`fam-${k}`} type={type ?? 'text'} className="input" value={f[k]} required={k === 'child_name'}
                  onChange={(e) => setF({ ...f, [k]: e.target.value })} />
              </div>
            ))}
          <div className="col-span-2 flex flex-wrap items-center gap-2">
            <button className="btn-primary" disabled={pending}>Save</button>
            <button type="button" className="btn-danger ml-auto" disabled={deleting}
              onClick={() => { if (window.confirm(`Delete ${trial.child_name}'s request? This can't be undone.`)) startDelete(async () => { await deleteTrial(slug, trial.id); router.refresh(); }); }}>
              Delete request
            </button>
          </div>
        </form>
      )}
      <div className="mt-2">{note}</div>
    </Card>
  );
}

export function FirstDayCard({ slug, trial, className, classDetail }: { slug: string; trial: Trial; className: string; classDetail: string }) {
  const { save, pending, note } = useSave(slug, trial.id);
  const [editing, setEditing] = useState(!trial.first_day);
  const [time, setTime] = useState(trial.first_day_time ?? '');
  const d = trial.first_day ? new Date(trial.first_day + 'T12:00:00Z') : null;
  const part = (o: Intl.DateTimeFormatOptions) => d!.toLocaleDateString('en-US', { timeZone: 'UTC', ...o });

  return (
    <Card eyebrow="Trial class" title="First day" action={trial.first_day ? <EditBtn on={editing} onClick={() => setEditing(!editing)} /> : undefined}>
      <div className="flex items-center gap-4">
        <div className={`flex h-[84px] w-[72px] shrink-0 flex-col items-center justify-center rounded-xl border-2 ${d ? 'border-navy' : 'border-dashed border-[#c7cfda]'}`}>
          {d ? (
            <>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-brand">{part({ weekday: 'short' })}</span>
              <span className="font-display text-4xl leading-none text-navy">{part({ day: 'numeric' })}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-brand">{part({ month: 'short' })}</span>
            </>
          ) : <span className="px-2 text-center text-[10px] font-semibold text-[#9aa4b4]">Not set</span>}
        </div>
        <div className="min-w-0">
          <div className="font-semibold">{className || 'Class'}</div>
          {classDetail && <div className="text-xs text-slate-brand">{classDetail}</div>}
          <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-navy">
            <Clock className="h-3.5 w-3.5" />{trial.first_day_time || trial.requested_time || 'Time not set'}
          </div>
        </div>
      </div>
      {editing && (
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#edf0f4] pt-4">
          <div>
            <label htmlFor="first_day" className="label text-[10px]">Date</label>
            <input id="first_day" type="date" className="input" defaultValue={trial.first_day ?? ''} disabled={pending}
              onChange={(e) => save({ first_day: e.target.value || null }, e.target.value ? 'First day set. It moves to Upcoming on the board.' : 'First day cleared.')} />
          </div>
          <div>
            <label htmlFor="first_day_time" className="label text-[10px]">Time</label>
            <input id="first_day_time" className="input" placeholder="4:30 PM" value={time} onChange={(e) => setTime(e.target.value)}
              onBlur={() => time !== (trial.first_day_time ?? '') && save({ first_day_time: time || null })} />
          </div>
        </div>
      )}
      <div className="mt-2">{note}</div>
    </Card>
  );
}

export interface CheckItem { id: string; label: string; done: boolean; sub: string; auto?: boolean }

export function ChecklistCard({ slug, trialId, items, showedUp, showAttendance }: {
  slug: string; trialId: string; items: CheckItem[]; showedUp: boolean | null; showAttendance: boolean;
}) {
  const { save, pending, note } = useSave(slug, trialId);
  const stamp = (on: boolean) => (on ? new Date().toISOString() : null);
  const toggle = (id: string, v: boolean) => {
    if (id === 'in_sportsengine') save({ in_sportsengine: v });
    else if (id === 'spot_email_sent_at' || id === 'called_at' || id === 'followed_up_at') save({ [id]: stamp(v) } as TrialPatch);
  };
  const doneCount = items.filter((i) => i.done).length;

  return (
    <Card eyebrow="Next steps" title="Request checklist" action={<span className="text-xs font-semibold text-slate-brand">{doneCount} of {items.length} complete</span>}>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.id}>
            <label htmlFor={`chk-${i.id}`} className={`flex h-full items-start gap-3 rounded-xl border px-3.5 py-3 ${i.auto ? '' : 'cursor-pointer hover:border-navy/40'} ${i.done ? 'border-[#cfe5d7] bg-[#f5fbf7]' : 'border-[#e3e7ee]'}`}>
              <CheckBox id={`chk-${i.id}`} label={i.label} checked={i.done} disabled={pending || i.auto} onChange={(v) => toggle(i.id, v)} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{i.label}</span>
                <span className="block text-xs text-slate-brand">{i.sub}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {showAttendance && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#edf0f4] pt-4">
          <span className="text-sm font-semibold">Showed up for their first day?</span>
          <div className="inline-flex overflow-hidden rounded-lg border border-[#d6dce5]">
            {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }].map((o) => (
              <button key={o.l} type="button" aria-pressed={showedUp === o.v} disabled={pending}
                onClick={() => save({ showed_up: showedUp === o.v ? null : o.v })}
                className={`px-4 py-1.5 text-xs font-bold ${showedUp === o.v ? (o.v ? 'bg-stage-won text-white' : 'bg-red-600 text-white') : 'bg-white text-slate-brand hover:bg-[#f3f5f9]'}`}>{o.l}</button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-2">{note}</div>
    </Card>
  );
}

export function NotesCard({ slug, trial, lastUpdated }: { slug: string; trial: Trial; lastUpdated: string }) {
  const { save, pending, note } = useSave(slug, trial.id);
  const [notes, setNotes] = useState(trial.notes ?? '');
  return (
    <Card eyebrow="Family context" title="Notes">
      <label htmlFor="notes" className="sr-only">Notes</label>
      <textarea id="notes" rows={4} className="input rounded-xl" value={notes} onChange={(e) => setNotes(e.target.value)}
        placeholder="Excited but a little nervous. Mom asked if she can watch from the lobby…" />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-slate-brand">{lastUpdated}</span>
        <div className="flex items-center gap-3">{note}
          <button className="btn-ghost rounded-xl" disabled={pending || notes === (trial.notes ?? '')} onClick={() => save({ notes }, 'Notes saved.')}>Save notes</button>
        </div>
      </div>
    </Card>
  );
}

export function WaitlistCard({ slug, trial, onList, position, total, since, canAdd }: {
  slug: string; trial: Trial; onList: boolean; position: number | null; total: number; since: string; canAdd: boolean;
}) {
  const { save, pending, note } = useSave(slug, trial.id);
  if (!onList && !canAdd) return null;
  if (!onList) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-[#d6dce5] px-5 py-3">
        <span className="text-sm text-slate-brand">Class is full? Put this family on the waitlist and offer them the next spot.</span>
        <div className="flex items-center gap-3">{note}
          <button type="button" className="btn-ghost rounded-xl" disabled={pending}
            onClick={() => save({ waitlisted_at: new Date().toISOString(), offered_at: null }, 'Added to the waitlist.')}>Move to waitlist</button>
        </div>
      </div>
    );
  }
  return (
    <section className="rounded-2xl border border-[#ecd9ae] bg-[#fdf8ec] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white font-display text-3xl text-stage-wait shadow-sm">#{position ?? '–'}</span>
          <div>
            <div className="eyebrow text-[10px] text-stage-wait">On the waitlist</div>
            <div className="display text-[26px] leading-none">{position ? `${ordinal(position)} in line` : 'Waiting for a spot'}</div>
            <div className="mt-1 text-xs text-slate-brand">{total > 1 ? `${total} families waiting for this class · ` : ''}Joined {since}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {note}
          <button type="button" className="btn-ghost rounded-xl" disabled={pending}
            onClick={() => { if (window.confirm('Take this family off the waitlist and mark them Not enrolling?')) save({ status: 'not_enrolling' }, 'Removed from the waitlist.'); }}>No longer interested</button>
          <button type="button" className="btn-primary rounded-xl" disabled={pending}
            onClick={() => save({ offered_at: new Date().toISOString() }, 'Spot offered. They’re in New Requests now. Send the “Spot is ready” message next.')}>Offer spot</button>
        </div>
      </div>
    </section>
  );
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

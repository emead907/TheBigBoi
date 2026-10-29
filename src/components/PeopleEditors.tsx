'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateAccount, updateMemberNotes } from '@/app/[gym]/people/actions';
import { Card } from './ui';
import { Edit } from './icons';

export function AccountEditor({ slug, account }: { slug: string; account: { id: string; first_name: string | null; last_name: string | null; email: string | null; mobile: string | null; phone: string | null; notes: string | null } }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const fields: [keyof typeof account, string, string?][] = [['first_name', 'First name'], ['last_name', 'Last name'], ['email', 'Email', 'email'], ['mobile', 'Mobile', 'tel'], ['phone', 'Phone', 'tel']];
  return (
    <Card eyebrow="Contact" title="Parent / guardian" action={<button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-navy hover:underline" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : <><Edit className="h-3.5 w-3.5" />Edit</>}</button>}>
      <form className="space-y-3" action={(fd) => start(async () => { const r = await updateAccount(slug, account.id, fd); setMsg(r.ok ? 'Saved.' : r.error ?? 'Not saved.'); if (r.ok) setEditing(false); router.refresh(); })}>
        {fields.map(([k, l, type]) => (
          <div key={k}>
            <label htmlFor={`acct-${k}`} className="label text-[10px]">{l}</label>
            {editing ? <input id={`acct-${k}`} name={k} type={type ?? 'text'} className="input" defaultValue={account[k] ?? ''} />
              : <div className="text-sm font-semibold">{k === 'email' && account.email ? <a className="text-navy hover:underline" href={`mailto:${account.email}`}>{account.email}</a>
                : (k === 'mobile' || k === 'phone') && account[k] ? <a className="text-navy hover:underline" href={`tel:${account[k]}`}>{account[k]}</a> : account[k] || '—'}</div>}
          </div>
        ))}
        <div>
          <label htmlFor="acct-notes" className="label text-[10px]">Notes</label>
          <textarea id="acct-notes" name="notes" rows={3} className="input" defaultValue={account.notes ?? ''} placeholder="Anything the front desk should know about this family" />
        </div>
        <div className="flex items-center gap-3"><button className="btn-primary rounded-xl" disabled={pending}>Save</button><span className="text-xs text-slate-brand" role="status">{msg}</span></div>
      </form>
    </Card>
  );
}

export function MemberNotes({ slug, id, initial }: { slug: string; id: string; initial: string }) {
  const [notes, setNotes] = useState(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState('');
  return (
    <div className="mt-3">
      <label htmlFor={`mn-${id}`} className="eyebrow text-[10px]">Coach notes</label>
      <textarea id={`mn-${id}`} rows={2} className="input mt-1 text-xs" value={notes} onChange={(e) => { setNotes(e.target.value); setSaved(''); }}
        placeholder="Skills, goals, allergies the coaches should know…" />
      {notes !== initial && (
        <button className="btn-ghost mt-1 rounded-lg px-2.5 py-1 text-xs" disabled={pending}
          onClick={() => start(async () => { const r = await updateMemberNotes(slug, id, notes); setSaved(r.ok ? 'Saved.' : r.error ?? ''); })}>Save note</button>
      )}
      {saved && <span className="ml-2 text-xs text-stage-won">{saved}</span>}
    </div>
  );
}

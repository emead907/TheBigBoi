'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GROUP_NAMES, LEVELS, PAYMENT_DATES, eligible, feePaid, meetDates, type TeamAthlete, type TeamFee, type TeamGroup, type TeamMeet } from '@/lib/team';
import { money } from '@/lib/parties';
import { createAthlete, deleteAthlete, saveFee, setEntry, updateAthlete, type AthletePatch } from '@/app/[gym]/team/actions';
import { Card, CheckBox } from './ui';
import { Trash } from './icons';

export default function AthleteEditor({ slug, athlete, isOwner, meets, signedUp, groups, fee }: {
  slug: string; athlete: TeamAthlete; isOwner: boolean; meets: TeamMeet[]; signedUp: string[]; groups: TeamGroup[]; fee: TeamFee | null;
}) {
  const router = useRouter();
  const [a, setA] = useState(athlete);
  const [f, setF] = useState(athlete);
  const [entries, setEntries] = useState(signedUp);
  const [fe, setFe] = useState<TeamFee>(fee ?? { athlete_id: athlete.id, gym_id: athlete.gym_id, total: null, plan: null, paid_1: false, paid_2: false, paid_3: false, paid_4: false, notes: null });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText = 'Saved.') =>
    start(async () => { const r = await fn(); setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error ?? 'Not saved.' }); router.refresh(); });
  const quick = (patch: AthletePatch) => { setA({ ...a, ...patch } as TeamAthlete); setF({ ...f, ...patch } as TeamAthlete); run(() => updateAthlete(slug, a.id, patch)); };
  const fee$ = (patch: Partial<TeamFee>) => { setFe({ ...fe, ...patch }); run(() => saveFee(slug, a.id, patch)); };
  const text = (k: keyof TeamAthlete, label: string, type = 'text') => (
    <div><label htmlFor={`a-${k}`} className="label text-[10px]">{label}</label>
      <input id={`a-${k}`} type={type} className="input" value={(f[k] as string | number | null) ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );
  const checks: [keyof TeamAthlete, string][] = [
    ['contract_signed', 'Team contract signed'], ['usag_member', 'USA Gymnastics membership valid'], ['is_new', 'New this season'],
    ['backpack_needed', 'Needs a team backpack'], ['backpack_given', 'Backpack handed out'], ['practice_leo_received', 'Practice leo received'],
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-5">
        <Card eyebrow="Details" title="Athlete info">
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
            e.preventDefault();
            const patch: AthletePatch = { name: f.name, level: f.level, group_name: f.group_name, hours: f.hours, comp_leo_size: f.comp_leo_size,
              practice_leo_size: f.practice_leo_size, warmup_size: f.warmup_size, mom_email: f.mom_email, dad_email: f.dad_email, notes: f.notes };
            setA({ ...a, ...patch } as TeamAthlete); run(() => updateAthlete(slug, a.id, patch));
          }}>
            <div className="sm:col-span-2">{text('name', 'Name')}</div>
            <div><label htmlFor="a-level" className="label text-[10px]">Level</label>
              <select id="a-level" className="input" value={f.level ?? ''} onChange={(e) => setF({ ...f, level: e.target.value || null })}><option value="">—</option>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></div>
            <div><label htmlFor="a-group" className="label text-[10px]">Practice group</label>
              <select id="a-group" className="input" value={f.group_name ?? ''} onChange={(e) => setF({ ...f, group_name: e.target.value || null })}>
                <option value="">—</option>{(groups.length ? groups.map((g) => g.name) : [...GROUP_NAMES]).map((g) => <option key={g}>{g}</option>)}</select></div>
            {text('hours', 'Hours per week', 'number')}
            {text('comp_leo_size', 'Competition leo size')}
            {text('practice_leo_size', 'Practice leo size')}
            {text('warmup_size', 'Warm-up (full zip) size')}
            {text('mom_email', 'Mom’s email', 'email')}
            {text('dad_email', 'Dad’s email', 'email')}
            <div className="sm:col-span-2"><label htmlFor="a-notes" className="label text-[10px]">Notes</label>
              <textarea id="a-notes" rows={3} className="input" value={f.notes ?? ''} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
            <div className="flex items-center gap-3 sm:col-span-2"><button className="btn-primary rounded-xl" disabled={pending}>{pending ? 'Saving…' : 'Save details'}</button>
              {msg && <span role="status" className={`text-sm ${msg.ok ? 'text-stage-won' : 'text-red-700'}`}>{msg.text}</span>}</div>
          </form>
        </Card>

        <Card eyebrow="Season" title="Meets">
          <ul className="divide-y divide-[#edf0f4]">
            {meets.map((m) => {
              const on = entries.includes(m.id);
              const fits = eligible(a, m);
              return (
                <li key={m.id} className={`flex items-center justify-between gap-3 py-2.5 ${fits || on ? '' : 'opacity-50'}`}>
                  <div><span className="font-semibold">{m.name}</span>{m.required && fits && <span className="chip ml-2 bg-navy-50 text-[10px] uppercase tracking-wider text-navy">Required</span>}
                    <div className="text-xs text-slate-brand">{meetDates(m)}{!fits ? ` · not for ${a.level ?? 'this level'}` : ''}</div></div>
                  <CheckBox label={`Signed up for ${m.name}`} checked={on}
                    onChange={(v) => { setEntries(v ? [...entries, m.id] : entries.filter((x) => x !== m.id)); run(() => setEntry(slug, m.id, a.id, v)); }} />
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="min-w-0 space-y-5">
        <Card eyebrow="Checklist" title="Paperwork & gear">
          <ul className="space-y-2.5">{checks.map(([k, l]) => (
            <li key={k} className="flex items-center gap-3 text-sm"><CheckBox label={l} checked={!!a[k]} onChange={(v) => quick({ [k]: v })} />{l}</li>
          ))}</ul>
        </Card>

        {isOwner && (
          <Card eyebrow="Managers only" title="Comp fees">
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="f-total" className="label text-[10px]">Total</label>
                <input id="f-total" type="number" step="0.01" className="input" defaultValue={fe.total ?? ''} onBlur={(e) => fee$({ total: e.target.value === '' ? null : Number(e.target.value) })} /></div>
              <div><label htmlFor="f-plan" className="label text-[10px]">Plan</label>
                <select id="f-plan" className="input" value={fe.plan ?? ''} onChange={(e) => fee$({ plan: e.target.value || null })}><option value="">—</option><option>4 payments</option><option>Pay in full</option></select></div>
            </div>
            <div className="mt-3 space-y-2">
              {fe.plan === 'Pay in full' ? (
                <label className="flex items-center gap-3 text-sm"><CheckBox label="Paid in full" checked={fe.paid_1} onChange={(v) => fee$({ paid_1: v })} />Paid in full</label>
              ) : ([1, 2, 3, 4] as const).map((n) => (
                <label key={n} className="flex items-center gap-3 text-sm"><CheckBox label={`${PAYMENT_DATES[n - 1]} payment`} checked={fe[`paid_${n}`]} onChange={(v) => fee$({ [`paid_${n}`]: v })} />
                  {PAYMENT_DATES[n - 1]} payment{fe.total != null ? <span className="text-slate-brand"> · {money(Number(fe.total) / 4)}</span> : ''}</label>
              ))}
            </div>
            {fe.total != null && <p className="mt-3 border-t border-[#edf0f4] pt-3 text-sm">Paid {money(feePaid(fe))} · <strong>Owes {money(Number(fe.total) - feePaid(fe))}</strong></p>}
          </Card>
        )}

        {isOwner && (
          <button className="btn-ghost w-full rounded-xl text-red-700" disabled={pending}
            onClick={() => { if (window.confirm(`Remove ${a.name} from the team? This deletes their sign-ups and fees.`)) run(() => deleteAthlete(slug, a.id)); }}>
            <Trash className="h-4 w-4" />Remove from team
          </button>
        )}
      </div>
    </div>
  );
}

export function NewAthleteForm({ slug }: { slug: string }) {
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <Card>
      <form className="grid gap-3 sm:grid-cols-2" action={(fd) => start(async () => { setError(''); const r = await createAthlete(slug, fd); if (r && !r.ok) setError(r.error); })}>
        <div className="sm:col-span-2"><label htmlFor="n-name" className="label text-[10px]">Name</label><input id="n-name" name="name" className="input" required /></div>
        <div><label htmlFor="n-level" className="label text-[10px]">Level</label><select id="n-level" name="level" className="input"><option value="">—</option>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></div>
        <div><label htmlFor="n-group" className="label text-[10px]">Practice group</label><select id="n-group" name="group_name" className="input"><option value="">—</option>{GROUP_NAMES.map((g) => <option key={g}>{g}</option>)}</select></div>
        <div><label htmlFor="n-hours" className="label text-[10px]">Hours per week</label><input id="n-hours" name="hours" type="number" className="input" /></div>
        <label className="flex items-center gap-2 self-end pb-3 text-sm"><input name="is_new" type="checkbox" className="h-4 w-4 accent-navy" defaultChecked />New this season (needs a backpack)</label>
        <div><label htmlFor="n-mom" className="label text-[10px]">Mom’s email</label><input id="n-mom" name="mom_email" type="email" className="input" /></div>
        <div><label htmlFor="n-dad" className="label text-[10px]">Dad’s email</label><input id="n-dad" name="dad_email" type="email" className="input" /></div>
        {error && <p className="text-sm text-red-700 sm:col-span-2">{error}</p>}
        <div className="sm:col-span-2"><button className="btn-primary rounded-xl" disabled={pending}>{pending ? 'Adding…' : 'Add athlete'}</button></div>
      </form>
    </Card>
  );
}

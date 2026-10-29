'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Channel, Gym, Template, TemplateKey } from '@/lib/types';
import { inviteStaff, removeStaff, rotateIntakeKey, saveGym, saveTemplate, type ActionResult } from '@/app/[gym]/actions';

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = (fn: () => Promise<ActionResult>) => start(async () => { setResult(await fn()); router.refresh(); });
  const note = result && (
    <p role="status" className={`text-sm ${result.ok ? 'text-stage-won' : 'text-red-700'}`}>{result.ok ? result.message ?? 'Saved.' : result.error}</p>
  );
  return { pending, run, note };
}

export function GymForm({ slug, gym }: { slug: string; gym: Gym }) {
  const { pending, run, note } = useAction();
  const fields: [keyof Gym, string, string][] = [
    ['name', 'Gym name', 'Gym Stars Gymnastics'], ['short_name', 'Short name', 'Gym Stars'],
    ['phone', 'Phone', '(208) 866-2699'], ['email', 'Reply-to email', 'gymstarsidahoinfo@gmail.com'],
    ['from_email', 'Send emails from', 'Gym Stars Gymnastics <hello@gymstarsidaho.com>'],
    ['sms_from', 'Texting number (Twilio)', '+12085551234'], ['address', 'Address', ''], ['website', 'Website', 'https://'],
  ];
  return (
    <section className="card p-5">
      <h2 className="display text-3xl">Gym details</h2>
      <form className="mt-3 grid gap-3 sm:grid-cols-2" action={(fd) => run(() => saveGym(slug, fd))}>
        {fields.map(([k, l, ph]) => (
          <div key={k}>
            <label htmlFor={`g-${k}`} className="label">{l}</label>
            <input id={`g-${k}`} name={k} className="input" defaultValue={(gym[k] as string) ?? ''} placeholder={ph} />
          </div>
        ))}
        <p className="text-xs text-slate-brand sm:col-span-2">The &ldquo;send from&rdquo; address must use a domain you&apos;ve verified in Resend (for example gymstarsidaho.com). Parent replies go to the reply-to email.</p>
        <div className="flex items-center gap-3 sm:col-span-2"><button className="btn-primary" disabled={pending}>Save</button>{note}</div>
      </form>
    </section>
  );
}

export function TemplateForm({ slug, k, channel, label, template, canAuto }: {
  slug: string; k: TemplateKey; channel: Channel; label: string; template: Template | null; canAuto: boolean;
}) {
  const { pending, run, note } = useAction();
  const id = `t-${k}-${channel}`;
  return (
    <form className="card space-y-2 p-4" action={(fd) => run(() => saveTemplate(slug, k, channel, fd))}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-navy">{label} · {channel === 'email' ? 'Email' : 'Text'}</h3>
        {canAuto && (
          <label htmlFor={`${id}-auto`} className="flex items-center gap-2 text-xs font-semibold text-slate-brand">
            <input id={`${id}-auto`} type="checkbox" name="auto_send" defaultChecked={template?.auto_send ?? false} className="h-4 w-4 accent-navy" />
            Send automatically
          </label>
        )}
      </div>
      {channel === 'email' && (
        <input id={`${id}-subject`} name="subject" aria-label="Subject" className="input" placeholder="Subject" defaultValue={template?.subject ?? ''} />
      )}
      <textarea id={`${id}-body`} name="body" aria-label="Message" rows={channel === 'email' ? 9 : 3} className="input text-xs" required defaultValue={template?.body ?? ''} />
      {channel === 'sms' && <p className="text-xs text-slate-brand">Texts only go to families who agreed to texts. Keep &ldquo;Reply STOP to opt out&rdquo; in the first text a family gets.</p>}
      <div className="flex items-center gap-3"><button className="btn-ghost" disabled={pending}>Save</button>{note}</div>
    </form>
  );
}

export function IntakeBox({ slug, endpoint, intakeKey }: { slug: string; endpoint: string; intakeKey: string }) {
  const { pending, run, note } = useAction();
  const snippet = `fetch('${endpoint}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-intake-key': '${intakeKey}' },
  body: JSON.stringify({
    class: 'Shining Stars (Girls Beginner)',
    requested_time: 'Monday at 4:30–5:30 PM',
    parent: 'Kaitlin Wills', email: 'parent@example.com', phone: '2085551234', zip: '83642',
    sms_opt_in: true,
    children: [{ name: 'Layla Wills', birthday: '2018-08-15' }],
  }),
});`;
  return (
    <section className="card p-5">
      <h2 className="display text-3xl">Website form</h2>
      <p className="mt-1 text-sm text-slate-brand">Add this to the server code that handles your website&apos;s class request form (an API route, not the browser), so new requests land on the board automatically. Keep the key private: anyone with it can add requests.</p>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-[#0f1b2d] p-4 text-xs text-[#dfe6f0]"><code>{snippet}</code></pre>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-ghost" onClick={() => navigator.clipboard?.writeText(snippet)}>Copy code</button>
        <button type="button" className="btn-danger" disabled={pending}
          onClick={() => { if (window.confirm('Make a new key? Your website will stop sending requests until you update it.')) run(() => rotateIntakeKey(slug)); }}>
          Make a new key
        </button>
        {note}
      </div>
    </section>
  );
}

export function StaffPanel({ slug, me, members, gyms, currentGymId }: {
  slug: string; me: string; currentGymId: string;
  members: { user_id: string; role: string; display_name: string | null; email: string }[];
  gyms: { id: string; name: string }[];
}) {
  const { pending, run, note } = useAction();
  return (
    <section className="card p-5">
      <h2 className="display text-3xl">Staff</h2>
      <ul className="mt-3 divide-y divide-mist">
        {members.map((m) => (
          <li key={m.user_id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
            <div className="min-w-0 flex-1"><div className="font-semibold">{m.display_name || m.email}</div><div className="text-xs text-slate-brand">{m.email}</div></div>
            <span className="chip bg-navy-50 text-navy">{m.role === 'owner' ? 'Owner' : 'Staff'}</span>
            {m.user_id !== me && (
              <button className="text-xs font-semibold text-red-700 hover:underline" disabled={pending}
                onClick={() => { if (window.confirm(`Remove ${m.display_name || m.email} from this gym?`)) run(() => removeStaff(slug, m.user_id)); }}>Remove</button>
            )}
          </li>
        ))}
      </ul>
      <form className="mt-4 grid gap-3 border-t border-mist pt-4 sm:grid-cols-4" action={(fd) => run(() => inviteStaff(slug, fd))}>
        <div className="sm:col-span-2"><label htmlFor="s-email" className="label">Email</label><input id="s-email" name="email" type="email" required className="input" /></div>
        <div><label htmlFor="s-name" className="label">Name</label><input id="s-name" name="display_name" className="input" placeholder="Amanda" /></div>
        <div><label htmlFor="s-role" className="label">Role</label>
          <select id="s-role" name="role" className="input"><option value="staff">Staff</option><option value="owner">Owner</option></select></div>
        {gyms.length > 1 && (
          <fieldset className="flex flex-wrap gap-4 sm:col-span-4">
            <legend className="label">Gyms</legend>
            {gyms.map((g) => (
              <label key={g.id} htmlFor={`s-gym-${g.id}`} className="flex items-center gap-2 text-sm">
                <input id={`s-gym-${g.id}`} type="checkbox" name="gym_ids" value={g.id} defaultChecked={g.id === currentGymId} className="h-4 w-4 accent-navy" />{g.name}
              </label>
            ))}
          </fieldset>
        )}
        <div className="flex items-center gap-3 sm:col-span-4"><button className="btn-primary" disabled={pending}>Send invite</button>{note}</div>
        <p className="text-xs text-slate-brand sm:col-span-4">Staff can use the board, add requests and send messages. Owners can also change settings and messages, and manage staff.</p>
      </form>
    </section>
  );
}

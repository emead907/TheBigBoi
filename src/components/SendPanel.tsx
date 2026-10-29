'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Channel, TemplateKey } from '@/lib/types';
import { sendTrialMessage } from '@/app/[gym]/actions';

export interface SendOption {
  key: TemplateKey; channel: Channel; label: string; subject: string | null; body: string; blocked: string | null;
}

export default function SendPanel({ slug, trialId, options }: { slug: string; trialId: string; options: SendOption[] }) {
  const router = useRouter();
  const [pick, setPick] = useState(0);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const o = options[pick];

  if (!o) return (
    <section className="card p-5"><h2 className="display text-2xl">Send a message</h2>
      <p className="mt-2 text-sm text-slate-brand">No message templates yet. An owner can add them in Settings.</p></section>
  );

  return (
    <section className="card p-5">
      <h2 className="display text-2xl">Send a message</h2>
      <label htmlFor="send-pick" className="label mt-3">Message</label>
      <select id="send-pick" className="input" value={pick} onChange={(e) => { setPick(Number(e.target.value)); setResult(null); }}>
        {options.map((op, i) => <option key={`${op.key}-${op.channel}`} value={i}>{op.label} · {op.channel === 'email' ? 'Email' : 'Text'}</option>)}
      </select>
      <div className="mt-3 max-h-64 overflow-y-auto rounded-lg bg-paper p-3 text-xs">
        {o.subject && <div className="mb-2 font-semibold">{o.subject}</div>}
        <p className="whitespace-pre-line">{o.body}</p>
      </div>
      {o.blocked && <p className="mt-2 text-xs text-[#9a5a12]">{o.blocked}</p>}
      <button className="btn-primary mt-3 w-full" disabled={pending || !!o.blocked}
        onClick={() => start(async () => {
          const res = await sendTrialMessage(slug, trialId, o.key, o.channel);
          setResult(res.ok ? { ok: true, text: res.message ?? 'Sent.' } : { ok: false, text: res.error });
          router.refresh();
        })}>
        {pending ? 'Sending…' : `Send ${o.channel === 'email' ? 'email' : 'text'}`}
      </button>
      {result && <p className={`mt-2 text-sm ${result.ok ? 'text-stage-won' : 'text-red-700'}`} role="status">{result.text}</p>}
    </section>
  );
}

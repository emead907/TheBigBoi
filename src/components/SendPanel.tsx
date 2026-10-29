'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Channel, TemplateKey } from '@/lib/types';
import { sendTrialMessage } from '@/app/[gym]/actions';
import { Card } from './ui';
import { Mail, Message, Send } from './icons';

export interface SendOption {
  key: TemplateKey; channel: Channel; label: string; subject: string | null; body: string; blocked: string | null;
}

const KEYS: { key: TemplateKey; label: string }[] = [
  { key: 'spot_ready', label: 'Spot is ready' },
  { key: 'first_day_reminder', label: 'First-day reminder' },
  { key: 'follow_up', label: 'Follow-up' },
];

export default function SendPanel({ slug, trialId, options, suggested = 'spot_ready' }: {
  slug: string; trialId: string; options: SendOption[]; suggested?: TemplateKey;
}) {
  const router = useRouter();
  const [key, setKey] = useState<TemplateKey>(suggested);
  const [channel, setChannel] = useState<Channel>('email');
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const o = options.find((x) => x.key === key && x.channel === channel);

  return (
    <Card eyebrow="Family message" title="Send a message">
      <div role="tablist" aria-label="Message" className="-mt-1 flex border-b border-[#e3e7ee]">
        {KEYS.map((k) => (
          <button key={k.key} role="tab" aria-selected={key === k.key} onClick={() => { setKey(k.key); setResult(null); }}
            className={`relative flex-1 pb-2.5 text-xs font-semibold ${key === k.key ? 'text-navy' : 'text-slate-brand hover:text-navy'}`}>
            {k.label}
            {key === k.key && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded bg-navy" />}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-[#eef1f6] p-1" role="radiogroup" aria-label="Send by">
        {([['email', 'Email', Mail], ['sms', 'Text', Message]] as const).map(([c, l, Icon]) => (
          <button key={c} role="radio" aria-checked={channel === c} onClick={() => { setChannel(c); setResult(null); }}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold ${channel === c ? 'bg-white text-navy shadow-sm' : 'text-slate-brand'}`}>
            <Icon className="h-4 w-4" />{l}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-[#e3e7ee] p-4">
        <div className="eyebrow text-[10px]">Preview</div>
        {o ? (
          <div className="mt-2 max-h-72 overflow-y-auto text-xs leading-relaxed">
            {o.subject && <div className="mb-2 text-sm font-semibold text-navy">{o.subject}</div>}
            <p className="whitespace-pre-line text-[#3b4658]">{o.body}</p>
          </div>
        ) : <p className="mt-2 text-xs text-slate-brand">No {channel === 'email' ? 'email' : 'text'} template for this yet. An owner can add one in Settings.</p>}
      </div>

      {o?.blocked && <p className="mt-3 rounded-lg bg-[#fff6e5] px-3 py-2 text-xs text-[#8a5300]">{o.blocked}</p>}
      <button className="btn-primary mt-4 w-full rounded-xl py-3" disabled={pending || !o || !!o.blocked}
        onClick={() => start(async () => {
          const res = await sendTrialMessage(slug, trialId, key, channel);
          setResult(res.ok ? { ok: true, text: res.message ?? 'Sent.' } : { ok: false, text: res.error });
          router.refresh();
        })}>
        <Send className="h-4 w-4" />{pending ? 'Sending…' : `Send ${channel === 'email' ? 'email' : 'text'}`}
      </button>
      {result && <p role="status" className={`mt-2 text-sm ${result.ok ? 'text-stage-won' : 'text-red-700'}`}>{result.text}</p>}
    </Card>
  );
}

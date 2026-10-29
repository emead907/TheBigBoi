'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    const supabase = createClient();
    const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`,
      },
    });
    if (error) {
      setState('error');
      setError(/signups not allowed|not found/i.test(error.message)
        ? 'No staff account uses that email. Ask a gym owner to invite you.'
        : error.message);
    } else setState('sent');
  }

  if (state === 'sent') {
    return (
      <div className="text-center">
        <h2 className="display text-2xl">Check your email</h2>
        <p className="mt-2 text-sm">We sent a sign-in link to <strong>{email}</strong>. Open it on this device.</p>
        <button className="btn-ghost mt-4" onClick={() => setState('idle')}>Use a different email</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" type="email" required autoComplete="email" className="input"
          value={email} onChange={(e) => setEmail(e.target.value)} placeholder="The email your gym owner invited" />
      </div>
      {state === 'error' && <p className="text-sm text-red-700">{error}</p>}
      <button className="btn-primary w-full" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
      </button>
    </form>
  );
}

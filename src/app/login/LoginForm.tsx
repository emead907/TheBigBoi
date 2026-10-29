'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Mode = 'password' | 'forgot' | 'sent';

export default function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const origin = () => process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setError(/invalid login/i.test(error.message)
        ? "That email and password don't match. Try again, or use \"Forgot password\" to set a new one."
        : error.message);
      return;
    }
    router.replace(safeNext);
    router.refresh();
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin()}/auth/callback?next=/set-password`,
    });
    setBusy(false);
    if (error) setError(error.message);
    else setMode('sent');
  }

  if (mode === 'sent') {
    return (
      <div className="text-center">
        <h2 className="display text-2xl">Check your email</h2>
        <p className="mt-2 text-sm">If <strong>{email}</strong> has a staff account, we sent a link to set a new password.</p>
        <button className="btn-ghost mt-4" onClick={() => setMode('password')}>Back to sign in</button>
      </div>
    );
  }

  const emailField = (
    <div>
      <label htmlFor="email" className="label">Email</label>
      <input id="email" type="email" required autoComplete="username" className="input"
        value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
    </div>
  );

  if (mode === 'forgot') {
    return (
      <form onSubmit={sendReset} className="space-y-4">
        <p className="text-sm">Enter your email and we&apos;ll send you a link to set a new password.</p>
        {emailField}
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Sending…' : 'Email me a reset link'}</button>
        <button type="button" className="w-full text-sm font-semibold text-navy hover:underline" onClick={() => { setMode('password'); setError(''); }}>
          Back to sign in
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={signIn} className="space-y-4">
      {emailField}
      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className="label">Password</label>
          <button type="button" className="text-xs font-semibold text-navy hover:underline" onClick={() => { setMode('forgot'); setError(''); }}>
            Forgot password?
          </button>
        </div>
        <input id="password" type="password" required autoComplete="current-password" className="input"
          value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}

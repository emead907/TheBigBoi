'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SetPasswordForm() {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setError('Use at least 8 characters.');
    if (pw !== pw2) return setError("The two passwords don't match.");
    setBusy(true);
    setError('');
    const { error } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError(error.message);
    router.replace('/');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="new-password" className="label">New password</label>
        <input id="new-password" type="password" autoComplete="new-password" required className="input" value={pw} onChange={(e) => setPw(e.target.value)} />
        <p className="mt-1 text-xs text-slate-brand">At least 8 characters.</p>
      </div>
      <div>
        <label htmlFor="confirm-password" className="label">Type it again</label>
        <input id="confirm-password" type="password" autoComplete="new-password" required className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
    </form>
  );
}

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SetPasswordForm from './SetPasswordForm';

export const dynamic = 'force-dynamic';

export default async function SetPasswordPage() {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) redirect('/login');
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="eyebrow">Gym Stars Hub</div>
          <h1 className="display mt-1 text-5xl">Set your password</h1>
          <p className="mt-2 text-sm text-slate-brand">For <strong>{user.email}</strong>. You&apos;ll use it to sign in from now on.</p>
        </div>
        <div className="card p-6"><SetPasswordForm /></div>
      </div>
    </main>
  );
}

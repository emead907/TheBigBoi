import LoginForm from './LoginForm';

export default function LoginPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="eyebrow">Gym Stars Gymnastics</div>
          <h1 className="display mt-1 text-5xl">Gym Stars Hub</h1>
          <p className="mt-2 text-sm text-slate-brand">Class requests, first days and enrollment.</p>
        </div>
        <div className="card p-6">
          {searchParams.error && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              That sign-in link didn&apos;t work or has expired. Request a new one below.
            </p>
          )}
          <LoginForm next={searchParams.next} />
        </div>
        <p className="mt-4 text-center text-xs text-slate-brand">Staff only. Ask a gym manager for an invite.</p>
      </div>
    </main>
  );
}

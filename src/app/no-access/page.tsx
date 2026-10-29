export default function NoAccess() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card max-w-md p-8 text-center">
        <h1 className="display text-4xl">No gym yet</h1>
        <p className="mt-2 text-sm">You&apos;re signed in, but you haven&apos;t been added to a gym. Ask a gym manager to invite you from Settings → Staff.</p>
        <form action="/auth/signout" method="post" className="mt-6">
          <button className="btn-ghost">Sign out</button>
        </form>
      </div>
    </main>
  );
}

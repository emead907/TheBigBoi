import Link from 'next/link';
import { getGymContext } from '@/lib/gym';
import GymSwitcher from '@/components/GymSwitcher';
import NavLinks from '@/components/NavLinks';

export default async function GymLayout({ children, params }: { children: React.ReactNode; params: { gym: string } }) {
  const ctx = await getGymContext(params.gym);
  return (
    <div className="min-h-screen">
      <header className="bg-navy text-white" style={{ backgroundColor: ctx.gym.brand_color }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href={`/${ctx.gym.slug}`} className="font-display text-3xl leading-none tracking-wide text-white">
            {ctx.gym.short_name} <span className="text-steel">Hub</span>
          </Link>
          <GymSwitcher gyms={ctx.gyms.map((g) => ({ slug: g.slug, name: g.short_name }))} current={ctx.gym.slug} />
          <NavLinks slug={ctx.gym.slug} isOwner={ctx.role === 'owner'} />
          <form action="/auth/signout" method="post" className="ml-auto">
            <button className="text-sm text-mist hover:text-white">Sign out · {ctx.actor}</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

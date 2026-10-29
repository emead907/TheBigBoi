import Link from 'next/link';
import { getGymContext } from '@/lib/gym';
import GymSwitcher from '@/components/GymSwitcher';
import NavLinks from '@/components/NavLinks';
import UserMenu from '@/components/UserMenu';
import { Sparkle } from '@/components/icons';
import { brandVars } from '@/lib/colors';

export default async function GymLayout({ children, params }: { children: React.ReactNode; params: { gym: string } }) {
  const ctx = await getGymContext(params.gym);
  return (
    <div className="min-h-screen" style={brandVars(ctx.gym.brand_color, ctx.gym.accent_color ?? '#7fc0d4')}>
      <header className="sticky top-0 z-20 bg-navy text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-4 sm:px-6">
          <Link href={`/${ctx.gym.slug}`} className="flex items-center gap-2.5 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 ring-1 ring-white/20"><Sparkle className="h-4 w-4" /></span>
            <span className="font-display text-[26px] leading-none tracking-wide">{ctx.gym.short_name.toUpperCase()} <span className="text-accent">HUB</span></span>
          </Link>
          <GymSwitcher gyms={ctx.gyms.map((g) => ({ slug: g.slug, name: g.short_name }))} current={ctx.gym.slug} />
          <div className="ml-auto flex items-center gap-4">
            <NavLinks slug={ctx.gym.slug} isOwner={ctx.role === 'owner'} />
            <UserMenu name={ctx.actor} role={ctx.role === 'owner' ? 'Manager' : 'Staff'} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6">{children}</main>
    </div>
  );
}

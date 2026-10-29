'use client';
import { usePathname, useRouter } from 'next/navigation';

export default function GymSwitcher({ gyms, current }: { gyms: { slug: string; name: string }[]; current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  if (gyms.length < 2) return null;
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Gym</span>
      <select
        id="gym-switcher"
        value={current}
        onChange={(e) => {
          const rest = pathname.split('/').slice(2).filter((p, i) => !(i === 0 && p === 'trials')).join('/');
          router.push(`/${e.target.value}${rest && !rest.startsWith('trials') ? `/${rest}` : ''}`);
        }}
        className="rounded-md border border-white/30 bg-white/10 px-2 py-1 text-sm font-semibold text-white focus:outline-none [&>option]:text-navy"
      >
        {gyms.map((g) => <option key={g.slug} value={g.slug}>{g.name}</option>)}
      </select>
    </label>
  );
}

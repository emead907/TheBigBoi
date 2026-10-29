'use client';
import { useRouter } from 'next/navigation';
import { ChevronDown } from './icons';

export default function GymSwitcher({ gyms, current }: { gyms: { slug: string; name: string }[]; current: string }) {
  const router = useRouter();
  const name = gyms.find((g) => g.slug === current)?.name ?? '';
  return (
    <label className="relative flex items-center gap-2 rounded-lg border border-white/25 px-3 py-1.5 text-sm font-semibold hover:bg-white/10">
      <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
      <span>{name}</span>
      {gyms.length > 1 && <ChevronDown className="h-4 w-4 opacity-80" />}
      {gyms.length > 1 && (
        <select id="gym-switcher" aria-label="Switch gym" value={current} onChange={(e) => router.push(`/${e.target.value}`)}
          className="absolute inset-0 cursor-pointer opacity-0">
          {gyms.map((g) => <option key={g.slug} value={g.slug}>{g.name}</option>)}
        </select>
      )}
    </label>
  );
}

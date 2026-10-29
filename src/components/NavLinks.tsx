'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavLinks({ slug, isOwner }: { slug: string; isOwner: boolean }) {
  const pathname = usePathname();
  const links = [
    { href: `/${slug}`, label: 'Board', match: (p: string) => p === `/${slug}` || p.startsWith(`/${slug}/trials`) },
    { href: `/${slug}/new`, label: 'Add request', match: (p: string) => p.startsWith(`/${slug}/new`) },
    { href: `/${slug}/reports`, label: 'Reports', match: (p: string) => p.startsWith(`/${slug}/reports`) },
    ...(isOwner ? [{ href: `/${slug}/settings`, label: 'Settings', match: (p: string) => p.startsWith(`/${slug}/settings`) }] : []),
  ];
  return (
    <nav className="flex flex-wrap gap-1">
      {links.map((l) => (
        <Link key={l.href} href={l.href}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold ${l.match(pathname) ? 'bg-white text-navy' : 'text-mist hover:bg-white/10 hover:text-white'}`}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

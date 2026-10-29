'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavLinks({ slug, isOwner }: { slug: string; isOwner: boolean }) {
  const pathname = usePathname();
  const links = [
    { href: `/${slug}`, label: 'Board', on: pathname === `/${slug}` || pathname.startsWith(`/${slug}/trials`) },
    { href: `/${slug}/people`, label: 'People', on: pathname.startsWith(`/${slug}/people`) },
    { href: `/${slug}/new`, label: 'Add Request', on: pathname.startsWith(`/${slug}/new`) },
    { href: `/${slug}/reports`, label: 'Reports', on: pathname.startsWith(`/${slug}/reports`) },
    ...(isOwner ? [{ href: `/${slug}/settings`, label: 'Settings', on: pathname.startsWith(`/${slug}/settings`) }] : []),
  ];
  return (
    <nav className="flex items-stretch gap-1 self-stretch" aria-label="Main">
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={l.on ? 'page' : undefined}
          className={`relative flex items-center px-3 text-sm font-semibold transition ${l.on ? 'text-white' : 'text-mist/80 hover:text-white'}`}>
          {l.label}
          {l.on && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-t bg-accent" />}
        </Link>
      ))}
    </nav>
  );
}

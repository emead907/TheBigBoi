import { ChevronDown } from './icons';

export default function UserMenu({ name, role }: { name: string; role: string }) {
  const initials = name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-lg py-1.5 pl-1 pr-2 hover:bg-white/10 [&::-webkit-details-marker]:hidden">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-xs font-bold text-navy">{initials}</span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-semibold capitalize">{name}</span>
          <span className="block text-[11px] text-mist/80">{role}</span>
        </span>
        <ChevronDown className="h-4 w-4 opacity-80" />
      </summary>
      <form action="/auth/signout" method="post" className="absolute right-0 mt-2 w-40 rounded-lg border border-mist bg-white p-1 text-navy shadow-lg">
        <button className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold hover:bg-paper">Sign out</button>
      </form>
    </details>
  );
}

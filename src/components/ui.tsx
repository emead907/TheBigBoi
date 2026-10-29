import { Check } from './icons';

export function PageHeader({ eyebrow, title, subtitle, right }: { eyebrow: string; title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="display mt-1 text-[44px] leading-[0.95]">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-slate-brand">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Card({ eyebrow, title, action, children, className = '' }: {
  eyebrow?: string; title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`card p-5 ${className}`}>
      {(eyebrow || title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {eyebrow && <div className="eyebrow text-[10px]">{eyebrow}</div>}
            {title && <h2 className="display text-[26px] leading-none">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const initials = name.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-navy-50 font-bold text-navy ${size === 'lg' ? 'h-14 w-14 text-base' : 'h-9 w-9 text-xs'}`}>
      {initials}
    </span>
  );
}

/** Big, square, green-when-checked checkbox. */
export function CheckBox({ id, checked, onChange, label, disabled }: {
  id?: string; checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean;
}) {
  return (
    <span className="relative inline-grid h-6 w-6 place-items-center">
      <input id={id} type="checkbox" aria-label={label} checked={checked} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer absolute inset-0 cursor-pointer appearance-none rounded-md border-2 border-[#b7c2cf] bg-white transition checked:border-stage-won checked:bg-stage-won focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-wait" />
      <Check className="pointer-events-none relative h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100" />
    </span>
  );
}

/** "Tiny Stars (Ages 3–4)" → { name: "Tiny Stars", detail: "Ages 3–4" } */
export function splitClass(c: string | null | undefined) {
  const m = (c ?? '').match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  return m ? { name: m[1], detail: m[2] } : { name: c ?? '', detail: '' };
}

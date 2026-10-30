// Small stroke icons (24px grid), sized by className.
type P = { className?: string };
const base = (className = 'h-4 w-4') => ({
  className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
});

export const Plus = ({ className }: P) => <svg {...base(className)}><path d="M12 5v14M5 12h14" /></svg>;
export const Search = ({ className }: P) => <svg {...base(className)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
export const Calendar = ({ className }: P) => <svg {...base(className)}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>;
export const ChevronRight = ({ className }: P) => <svg {...base(className)}><path d="m9 6 6 6-6 6" /></svg>;
export const ChevronDown = ({ className }: P) => <svg {...base(className)}><path d="m6 9 6 6 6-6" /></svg>;
export const ArrowLeft = ({ className }: P) => <svg {...base(className)}><path d="M19 12H5M12 19l-7-7 7-7" /></svg>;
export const Check = ({ className }: P) => <svg {...base(className)}><path d="M20 6 9 17l-5-5" /></svg>;
export const Phone = ({ className }: P) => <svg {...base(className)}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></svg>;
export const Mail = ({ className }: P) => <svg {...base(className)}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></svg>;
export const Message = ({ className }: P) => <svg {...base(className)}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
export const Send = ({ className }: P) => <svg {...base(className)}><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></svg>;
export const Clock = ({ className }: P) => <svg {...base(className)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
export const Users = ({ className }: P) => <svg {...base(className)}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></svg>;
export const Sparkle = ({ className }: P) => <svg {...base(className)}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></svg>;
export const TrendUp = ({ className }: P) => <svg {...base(className)}><path d="m22 7-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></svg>;
export const UserPlus = ({ className }: P) => <svg {...base(className)}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></svg>;
export const Edit = ({ className }: P) => <svg {...base(className)}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>;
export const Note = ({ className }: P) => <svg {...base(className)}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></svg>;
export const Alert = ({ className }: P) => <svg {...base(className)}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>;
export const Trash = ({ className }: P) => <svg {...base(className)}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>;

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getGymContext } from '@/lib/gym';
import { addDays } from '@/lib/dates';
import { byClass, byMonth, funnel, inLastDays, speed } from '@/lib/reports';
import type { Trial } from '@/lib/types';
import { Card, PageHeader } from '@/components/ui';
import { Calendar, Sparkle, TrendUp, Users } from '@/components/icons';

export const dynamic = 'force-dynamic';

const pct = (n: number | null) => (n == null ? '—' : `${Math.round(n * 100)}%`);
const RANGES = [{ d: 30, l: 'Last 30 days' }, { d: 90, l: 'Last 90 days' }, { d: 365, l: 'Last 12 months' }];

export default async function ReportsPage({ params, searchParams }: { params: { gym: string }; searchParams: { days?: string; all?: string } }) {
  const ctx = await getGymContext(params.gym);
  const days = RANGES.some((r) => r.d === Number(searchParams.days)) ? Number(searchParams.days) : 30;
  const supabase = createClient();
  const { data } = await supabase
    .from('trials')
    .select('gym_id, received_at, first_day, showed_up, status, class_name, spot_email_sent_at, closed_at')
    .in('gym_id', ctx.gyms.map((g) => g.id))
    .gte('received_at', addDays(ctx.today, -800))
    .limit(20000);
  type R = Pick<Trial, 'gym_id' | 'received_at' | 'first_day' | 'showed_up' | 'status' | 'class_name' | 'spot_email_sent_at' | 'closed_at'>;
  const all = (data ?? []) as R[];
  const mine = all.filter((t) => t.gym_id === ctx.gym.id);
  const tz = ctx.gym.timezone;
  const recent = inLastDays(mine, ctx.today, days, tz);
  const prior = inLastDays(mine, ctx.today, days, tz, days);
  const f = funnel(recent);
  const p = funnel(prior);
  const s = speed(recent, tz);
  const classes = byClass(recent);
  const showAll = searchParams.all === '1';
  const months = byMonth(mine, ctx.today, tz, 6);
  const gymRows = ctx.gyms.map((g) => ({ gym: g, ...funnel(inLastDays(all.filter((t) => t.gym_id === g.id), ctx.today, days, g.timezone)) }));
  const rangeLabel = RANGES.find((r) => r.d === days)!.l;

  const delta = (now: number | null, before: number | null, isRate = false) => {
    if (now == null || before == null || (!isRate && before === 0)) return null;
    const v = isRate ? (now - before) * 100 : ((now - before) / before) * 100;
    return { v, text: `${v >= 0 ? '+' : ''}${v.toFixed(isRate ? 1 : 0)}${isRate ? ' pts' : '%'}` };
  };
  const tiles = [
    { label: 'Requests', value: String(f.requested), d: delta(f.requested, p.requested), Icon: Users },
    { label: 'First days', value: String(f.scheduled), d: delta(f.scheduled, p.scheduled), Icon: Calendar },
    { label: 'Enrolled', value: String(f.enrolled), d: delta(f.enrolled, p.enrolled), Icon: Sparkle },
    { label: 'Enrollment rate', value: pct(f.rate), d: delta(f.rate, p.rate, true), Icon: TrendUp },
  ];
  const steps = [
    { label: 'Requested', n: f.requested, color: '#1b3f73' },
    { label: 'Scheduled', n: f.scheduled, color: '#2f5f8f' },
    { label: 'Showed up', n: f.showed, color: '#4a7aa3' },
    { label: 'Enrolled', n: f.enrolled, color: '#3f8a85' },
  ];

  // Line chart geometry
  const W = 560, H = 200, PX = 28, PY = 18;
  const maxM = Math.max(4, ...months.map((m) => m.requested));
  const niceMax = Math.ceil(maxM / 4) * 4;
  const pts = months.map((m, i) => ({ x: PX + (i * (W - PX * 2)) / (months.length - 1), y: H - PY - (m.requested / niceMax) * (H - PY * 2), m }));
  const line = pts.map((q, i) => {
    if (i === 0) return `M${q.x},${q.y}`;
    const a = pts[i - 1];
    const cx = (a.x + q.x) / 2;
    return `C${cx},${a.y} ${cx},${q.y} ${q.x},${q.y}`;
  }).join(' ');
  const area = `${line} L${pts[pts.length - 1].x},${H - PY} L${pts[0].x},${H - PY} Z`;

  const href = (o: { days?: number; all?: boolean; slug?: string }) =>
    `/${o.slug ?? ctx.gym.slug}/reports?days=${o.days ?? days}${(o.all ?? showAll) ? '&all=1' : ''}`;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Performance overview" title="Reports" subtitle="See how requests move from interest to enrollment."
        right={
          <div className="flex flex-wrap items-center gap-3">
            {ctx.gyms.length > 1 && (
              <nav className="flex rounded-xl border border-[#e3e7ee] bg-white p-1" aria-label="Gym">
                {ctx.gyms.map((g) => (
                  <Link key={g.id} href={href({ slug: g.slug })} aria-current={g.id === ctx.gym.id ? 'page' : undefined}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold ${g.id === ctx.gym.id ? 'bg-navy-50 text-navy' : 'text-slate-brand hover:text-navy'}`}>{g.short_name}</Link>
                ))}
              </nav>
            )}
            <nav className="flex rounded-xl border border-[#e3e7ee] bg-white p-1" aria-label="Date range">
              {RANGES.map((r) => (
                <Link key={r.d} href={href({ days: r.d })} aria-current={r.d === days ? 'page' : undefined}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${r.d === days ? 'bg-navy text-white' : 'text-slate-brand hover:text-navy'}`}>
                  {r.d === days && <Calendar className="h-3.5 w-3.5" />}{r.l}
                </Link>
              ))}
            </nav>
          </div>
        } />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map(({ label, value, d, Icon }) => (
          <div key={label} className="card p-5">
            <div className="flex items-start justify-between">
              <span className="text-sm font-semibold text-slate-brand">{label}</span>
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-navy-50 text-navy"><Icon className="h-4 w-4" /></span>
            </div>
            <div className="mt-2 font-display text-5xl leading-none tabular-nums text-navy">{value}</div>
            <div className="mt-2 text-xs text-slate-brand">
              {d ? <><span className={`font-semibold ${d.v >= 0 ? 'text-stage-won' : 'text-red-600'}`}>{d.text}</span> vs. previous {days} days</> : 'No earlier data to compare'}
            </div>
          </div>
        ))}
      </div>

      <Card eyebrow="Conversion" title="Enrollment funnel" action={<span className="text-xs text-slate-brand">{rangeLabel} · All classes</span>}>
        <div className="overflow-x-auto pb-1">
          <ol className="flex min-w-[640px] items-stretch" aria-label="Enrollment funnel">
            {steps.map((st, i) => (
              <li key={st.label} className="relative flex-1" style={{ marginLeft: i ? -6 : 0 }}>
                <div className="flex h-20 items-center justify-between py-3 pl-7 pr-9 text-white"
                  style={{ background: st.color, clipPath: i === 0 ? 'polygon(0 0, calc(100% - 22px) 0, 100% 50%, calc(100% - 22px) 100%, 0 100%)' : 'polygon(0 0, calc(100% - 22px) 0, 100% 50%, calc(100% - 22px) 100%, 0 100%, 22px 50%)' }}>
                  <div>
                    <div className="font-display text-4xl leading-none tabular-nums">{st.n}</div>
                    <div className="text-xs font-semibold opacity-90">{st.label}</div>
                  </div>
                  <div className="text-xs font-semibold tabular-nums opacity-90">{i === 0 ? '100%' : pct(steps[0].n ? st.n / steps[0].n : null)}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-[#edf0f4] pt-4 text-sm">
          <div><dt className="text-xs text-slate-brand">Avg. days from request to first day</dt><dd className="font-semibold tabular-nums">{s.avgDaysToFirstDay == null ? '—' : s.avgDaysToFirstDay.toFixed(1)}</dd></div>
          <div><dt className="text-xs text-slate-brand">Spot emails sent within a day</dt><dd className="font-semibold tabular-nums">{pct(s.spotWithinDay)}</dd></div>
          <div><dt className="text-xs text-slate-brand">Decided (enrolled or not)</dt><dd className="font-semibold tabular-nums">{f.decided}</dd></div>
        </dl>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card eyebrow="Class performance" title="Enrollment rate by class"
          action={classes.length > 5 ? <Link href={href({ all: !showAll })} className="text-sm font-semibold text-navy hover:underline">{showAll ? 'Show top 5' : 'View all'}</Link> : undefined}>
          {classes.length === 0 ? <p className="text-sm text-slate-brand">No requests in this range.</p> : (
            <ul className="space-y-4">
              {(showAll ? classes : classes.slice(0, 5)).map((c) => (
                <li key={c.name} className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-4">
                  <div className="min-w-0"><div className="truncate text-sm font-semibold">{c.name}</div><div className="text-xs text-slate-brand">{c.enrolled} enrolled · {c.requested} requests</div></div>
                  <div className="h-2.5 rounded-full bg-[#eef1f6]"><div className="h-2.5 rounded-full bg-[#3f8a85]" style={{ width: `${(c.rate ?? 0) * 100}%` }} /></div>
                  <div className="text-right text-sm font-semibold tabular-nums">{pct(c.rate)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card eyebrow="Demand trend" title="Requests per month"
          action={<span className="flex items-center gap-1.5 text-xs text-slate-brand"><span className="h-2 w-2 rounded-full bg-[#3f8a85]" />Requests</span>}>
          <svg viewBox={`0 0 ${W} ${H + 18}`} className="h-auto w-full" role="img" aria-label="Requests per month, last six months">
            <defs>
              <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#3f8a85" stopOpacity="0.28" /><stop offset="100%" stopColor="#3f8a85" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3, 4].map((g) => {
              const y = H - PY - (g / 4) * (H - PY * 2);
              return (
                <g key={g}>
                  <line x1={PX} x2={W - PX / 2} y1={y} y2={y} stroke="#e8ecf2" />
                  <text x={PX - 8} y={y + 3} textAnchor="end" fontSize="9" fill="#8a95a6">{(niceMax * g) / 4}</text>
                </g>
              );
            })}
            <path d={area} fill="url(#area)" />
            <path d={line} fill="none" stroke="#3f8a85" strokeWidth="2.5" />
            {pts.map((q, i) => (
              <g key={q.m.key}>
                <circle cx={q.x} cy={q.y} r={i === pts.length - 1 ? 6 : 4.5} fill="#fff" stroke="#3f8a85" strokeWidth="2.5" />
                <text x={q.x} y={q.y - 11} textAnchor="middle" fontSize="10" fontWeight="600" fill="#1b2433">{q.m.requested}</text>
                <text x={q.x} y={H + 12} textAnchor="middle" fontSize="10" fill="#5d6578">{q.m.label}</text>
              </g>
            ))}
          </svg>
        </Card>
      </div>

      {gymRows.length > 1 && (
        <Card eyebrow="Side by side" title="Gym comparison" action={<span className="text-xs text-slate-brand">{rangeLabel}</span>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead className="text-left text-[11px] font-bold uppercase tracking-[0.1em] text-slate-brand">
                <tr><th className="py-2">Gym</th><th className="py-2 text-right">Requests</th><th className="py-2 text-right">Scheduled</th><th className="py-2 text-right">Showed up</th><th className="py-2 text-right">Enrolled</th><th className="py-2 text-right">Rate</th></tr>
              </thead>
              <tbody className="divide-y divide-[#edf0f4]">
                {gymRows.map((r) => (
                  <tr key={r.gym.id} className={r.gym.id === ctx.gym.id ? 'font-semibold' : ''}>
                    <td className="py-2.5">{r.gym.short_name}</td><td className="py-2.5 text-right">{r.requested}</td><td className="py-2.5 text-right">{r.scheduled}</td>
                    <td className="py-2.5 text-right">{r.showed}</td><td className="py-2.5 text-right">{r.enrolled}</td><td className="py-2.5 text-right">{pct(r.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

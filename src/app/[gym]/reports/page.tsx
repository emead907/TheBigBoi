import { createClient } from '@/lib/supabase/server';
import { getGymContext } from '@/lib/gym';
import { addDays } from '@/lib/dates';
import { byClass, byMonth, funnel, inLastDays, speed } from '@/lib/reports';
import type { Trial } from '@/lib/types';

export const dynamic = 'force-dynamic';

const pct = (n: number | null) => (n == null ? '—' : `${Math.round(n * 100)}%`);

export default async function ReportsPage({ params, searchParams }: { params: { gym: string }; searchParams: { days?: string } }) {
  const ctx = await getGymContext(params.gym);
  const days = [30, 90, 365].includes(Number(searchParams.days)) ? Number(searchParams.days) : 90;
  const supabase = createClient();
  const since = addDays(ctx.today, -400);
  const { data } = await supabase
    .from('trials')
    .select('gym_id, received_at, first_day, showed_up, status, class_name, spot_email_sent_at, closed_at')
    .in('gym_id', ctx.gyms.map((g) => g.id))
    .gte('received_at', since)
    .limit(10000);
  const all = (data ?? []) as (Pick<Trial, 'gym_id' | 'received_at' | 'first_day' | 'showed_up' | 'status' | 'class_name' | 'spot_email_sent_at' | 'closed_at'>)[];
  const mine = all.filter((t) => t.gym_id === ctx.gym.id);
  const recent = inLastDays(mine, ctx.today, days, ctx.gym.timezone);
  const f = funnel(recent);
  const s = speed(recent, ctx.gym.timezone);
  const classes = byClass(recent);
  const months = byMonth(mine, ctx.today, ctx.gym.timezone);
  const maxMonth = Math.max(1, ...months.map((m) => m.requested));
  const gymRows = ctx.gyms.map((g) => ({ gym: g, ...funnel(inLastDays(all.filter((t) => t.gym_id === g.id), ctx.today, days, g.timezone)) }));

  const steps = [
    { label: 'Requested', n: f.requested },
    { label: 'First day scheduled', n: f.scheduled },
    { label: 'Showed up', n: f.showed },
    { label: 'Enrolled', n: f.enrolled },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">{ctx.gym.short_name}</div>
          <h1 className="display text-4xl">Reports</h1>
        </div>
        <nav className="flex gap-1 rounded-lg bg-white p-1 text-sm" aria-label="Date range">
          {[30, 90, 365].map((d) => (
            <a key={d} href={`?days=${d}`} className={`rounded-md px-3 py-1.5 font-semibold ${d === days ? 'bg-navy text-white' : 'text-slate-brand hover:text-navy'}`}>
              {d === 365 ? '12 months' : `${d} days`}
            </a>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Requests', value: String(f.requested) },
          { label: 'First days scheduled', value: String(f.scheduled) },
          { label: 'Enrolled', value: String(f.enrolled) },
          { label: 'Enrollment rate', value: pct(f.rate), note: f.decided ? `of ${f.decided} decided` : 'none decided yet' },
        ].map((t) => (
          <div key={t.label} className="card p-4">
            <div className="eyebrow">{t.label}</div>
            <div className="display mt-1 text-5xl tabular-nums">{t.value}</div>
            {t.note && <div className="text-xs text-slate-brand">{t.note}</div>}
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="display text-2xl">Funnel</h2>
          <div className="mt-4 space-y-3">
            {steps.map((st, i) => (
              <div key={st.label}>
                <div className="flex justify-between text-sm"><span className="font-semibold">{st.label}</span>
                  <span className="tabular-nums">{st.n}{i > 0 && steps[0].n ? ` · ${pct(st.n / steps[0].n)}` : ''}</span></div>
                <div className="mt-1 h-3 rounded-full bg-paper">
                  <div className="h-3 rounded-full bg-navy" style={{ width: `${steps[0].n ? (st.n / steps[0].n) * 100 : 0}%`, opacity: 1 - i * 0.18 }} />
                </div>
              </div>
            ))}
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-slate-brand">Avg. days to first day</dt><dd className="font-semibold tabular-nums">{s.avgDaysToFirstDay == null ? '—' : s.avgDaysToFirstDay.toFixed(1)}</dd></div>
            <div><dt className="text-slate-brand">Spot emails sent within a day</dt><dd className="font-semibold tabular-nums">{pct(s.spotWithinDay)}</dd></div>
          </dl>
        </section>

        <section className="card p-5">
          <h2 className="display text-2xl">Last 6 months</h2>
          <div className="mt-4 flex h-48 items-end gap-3" role="img" aria-label="Requests and enrollments per month">
            {months.map((m) => (
              <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end justify-center gap-1">
                  <div className="w-1/2 rounded-t bg-steel" style={{ height: `${(m.requested / maxMonth) * 100}%` }} title={`${m.requested} requests`} />
                  <div className="w-1/2 rounded-t bg-stage-won" style={{ height: `${(m.enrolled / maxMonth) * 100}%` }} title={`${m.enrolled} enrolled`} />
                </div>
                <div className="text-xs text-slate-brand">{m.label}</div>
                <div className="text-[11px] tabular-nums">{m.requested}/{m.enrolled}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 flex gap-4 text-xs text-slate-brand">
            <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-steel" />Requests</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-stage-won" />Enrolled</span>
          </p>
        </section>
      </div>

      <section className="card overflow-x-auto p-5">
        <h2 className="display text-2xl">By class</h2>
        {classes.length === 0 ? <p className="mt-2 text-sm text-slate-brand">No requests in this range.</p> : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-brand">
              <tr><th className="py-2">Class</th><th className="py-2 text-right">Requests</th><th className="py-2 text-right">First days</th><th className="py-2 text-right">Enrolled</th><th className="w-1/3 py-2 pl-4">Enrollment rate</th></tr>
            </thead>
            <tbody className="divide-y divide-mist tabular-nums">
              {classes.map((c) => (
                <tr key={c.name}>
                  <td className="py-2 pr-3">{c.name}</td><td className="py-2 text-right">{c.requested}</td>
                  <td className="py-2 text-right">{c.scheduled}</td><td className="py-2 text-right">{c.enrolled}</td>
                  <td className="py-2 pl-4"><div className="flex items-center gap-2"><div className="h-2 flex-1 rounded-full bg-paper">
                    <div className="h-2 rounded-full bg-stage-won" style={{ width: `${(c.rate ?? 0) * 100}%` }} /></div>
                    <span className="w-10 text-right">{pct(c.rate)}</span></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {gymRows.length > 1 && (
        <section className="card overflow-x-auto p-5">
          <h2 className="display text-2xl">Gym comparison</h2>
          <table className="mt-3 w-full text-sm tabular-nums">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-brand">
              <tr><th className="py-2">Gym</th><th className="py-2 text-right">Requests</th><th className="py-2 text-right">Scheduled</th><th className="py-2 text-right">Showed up</th><th className="py-2 text-right">Enrolled</th><th className="py-2 text-right">Rate</th></tr>
            </thead>
            <tbody className="divide-y divide-mist">
              {gymRows.map((r) => (
                <tr key={r.gym.id} className={r.gym.id === ctx.gym.id ? 'font-semibold' : ''}>
                  <td className="py-2">{r.gym.short_name}</td><td className="py-2 text-right">{r.requested}</td><td className="py-2 text-right">{r.scheduled}</td>
                  <td className="py-2 text-right">{r.showed}</td><td className="py-2 text-right">{r.enrolled}</td><td className="py-2 text-right">{pct(r.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

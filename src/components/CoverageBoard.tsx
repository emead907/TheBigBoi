'use client';
import { useMemo, useState, useTransition } from 'react';
import { addSlot, deleteSlot, updateSlot } from '@/app/[gym]/coverage/actions';
import { KIND_ORDER, slotState, type CoverageSlot, type CoveragePatch, type SlotState } from '@/lib/coverage';

const ROW: Record<SlotState, string> = {
  need: 'border-l-[#d93b4c] bg-[#fff6f7]',
  nocoach: 'border-l-[#e3a21a] bg-[#fffcf2]',
  ok: 'border-l-[#3aa36a] bg-white',
};

function dayLabel(ymd: string) {
  const d = new Date(`${ymd}T12:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'numeric', day: 'numeric' });
}

export default function CoverageBoard({ slug, initial }: { slug: string; initial: CoverageSlot[] }) {
  const [slots, setSlots] = useState(initial);
  const [onlyNeeds, setOnlyNeeds] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [, start] = useTransition();
  const [adding, setAdding] = useState<Record<string, { name: string; time: string }>>({});

  const days = useMemo(() => Array.from(new Set(slots.map((s) => s.day))).sort(), [slots]);
  const counts = useMemo(() => {
    const c = { need: 0, nocoach: 0, ok: 0 };
    slots.forEach((s) => { c[slotState(s)]++; });
    return c;
  }, [slots]);
  const names = useMemo(() => Array.from(new Set(slots.flatMap((s) => [s.coach, s.cover]).map((n) => n?.trim()).filter(Boolean) as string[])).sort(), [slots]);

  const local = (id: string, patch: CoveragePatch) => setSlots((all) => all.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const save = (id: string, patch: CoveragePatch) => {
    local(id, patch);
    start(async () => {
      const r = await updateSlot(slug, id, patch);
      setMsg(r.ok ? 'Saved' : `Couldn't save: ${r.error}`);
    });
  };

  return (
    <div className="space-y-5">
      <div className="card sticky top-[64px] z-10 flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="rounded-full bg-[#fde8ea] px-3 py-1 text-sm font-semibold text-[#a3202f]">{counts.need} need coverage</span>
        <span className="rounded-full bg-[#fff3d6] px-3 py-1 text-sm font-semibold text-[#8a5a00]">{counts.nocoach} no coach yet</span>
        <span className="rounded-full bg-[#e3f4ea] px-3 py-1 text-sm font-semibold text-[#1d6b3e]">{counts.ok} covered</span>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyNeeds} onChange={(e) => setOnlyNeeds(e.target.checked)} /> Only show what needs attention
        </label>
        {msg && <span className="ml-auto text-xs text-slate-brand">{msg}</span>}
      </div>

      <datalist id="coverage-coaches">{names.map((n) => <option key={n} value={n} />)}</datalist>

      {days.length === 0 && <div className="card p-5 text-sm text-slate-brand">Nothing to cover yet.</div>}

      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {days.map((day) => {
          const mine = slots.filter((s) => s.day === day);
          const add = adding[day] ?? { name: '', time: '' };
          return (
            <section key={day} className="card overflow-hidden">
              <h2 className="display px-4 pb-1 pt-3 text-[28px] leading-none text-navy">{dayLabel(day)}</h2>
              <div className="border-b border-mist px-4 pb-3 text-xs text-slate-brand">
                {mine.some((s) => s.kind === 'class') ? 'Classes, camp and open gym' : 'No classes. Camp and open gym only'}
              </div>
              {KIND_ORDER.map(([kind, label]) => {
                const rows = mine.filter((s) => s.kind === kind && (!onlyNeeds || slotState(s) !== 'ok'))
                  .sort((a, b) => (a.start_min ?? 9999) - (b.start_min ?? 9999) || a.name.localeCompare(b.name));
                if (!rows.length) return null;
                return (
                  <div key={kind}>
                    <div className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[2px] text-[#808080]">{label}</div>
                    {rows.map((s) => (
                      <div key={s.id} className={`border-l-4 border-t border-t-[#f0f0f2] px-4 py-2.5 ${ROW[slotState(s)]}`}>
                        <div className="flex items-baseline gap-2">
                          <span className="min-w-[84px] whitespace-nowrap text-xs font-bold text-slate-brand">{s.time_label}</span>
                          <span className="flex-1 text-sm font-bold">{s.name}</span>
                          {s.room && <span className="whitespace-nowrap text-[11px] text-[#808080]">{s.room}</span>}
                          <button aria-label={`Remove ${s.name}`} className="px-1 text-[#b0b0b0] hover:text-[#a3202f]"
                            onClick={() => {
                              setSlots((all) => all.filter((x) => x.id !== s.id));
                              start(async () => { const r = await deleteSlot(slug, s.id); setMsg(r.ok ? 'Removed' : `Couldn't remove: ${r.error}`); });
                            }}>×</button>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <input list="coverage-coaches" placeholder="Coach" defaultValue={s.coach ?? ''}
                            className="min-w-[120px] flex-1 rounded-lg border border-[#cfd6de] px-2.5 py-1.5 text-sm"
                            onChange={(e) => local(s.id, { coach: e.target.value })}
                            onBlur={(e) => save(s.id, { coach: e.target.value })} />
                          <span className="inline-flex overflow-hidden rounded-lg border border-[#cfd6de] text-sm font-semibold">
                            <button className={`px-2.5 py-1.5 ${s.status === 'in' ? 'bg-[#3aa36a] text-white' : 'bg-white text-slate-brand'}`}
                              onClick={() => save(s.id, { status: s.status === 'in' ? null : 'in' })}>In town</button>
                            <button className={`px-2.5 py-1.5 ${s.status === 'out' ? 'bg-[#d93b4c] text-white' : 'bg-white text-slate-brand'}`}
                              onClick={() => save(s.id, { status: s.status === 'out' ? null : 'out' })}>Out</button>
                          </span>
                          {s.status === 'out' && (
                            <input list="coverage-coaches" placeholder="Who is covering?" defaultValue={s.cover ?? ''}
                              className="min-w-[120px] flex-1 rounded-lg border border-[#cfd6de] px-2.5 py-1.5 text-sm"
                              onChange={(e) => local(s.id, { cover: e.target.value })}
                              onBlur={(e) => save(s.id, { cover: e.target.value })} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
              <form className="flex flex-wrap gap-2 border-t border-mist p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!add.name.trim()) return;
                  start(async () => {
                    const r = await addSlot(slug, day, add.name, add.time);
                    if (!r.ok) { setMsg(`Couldn't add: ${r.error}`); return; }
                    setAdding((a) => ({ ...a, [day]: { name: '', time: '' } }));
                    setMsg('Added');
                    window.location.reload();
                  });
                }}>
                <input placeholder="Add a class or camp slot" value={add.name}
                  onChange={(e) => setAdding((a) => ({ ...a, [day]: { ...add, name: e.target.value } }))}
                  className="min-w-[150px] flex-1 rounded-lg border border-[#cfd6de] px-2.5 py-1.5 text-sm" />
                <input placeholder="Time, like 4:30-5:30" value={add.time}
                  onChange={(e) => setAdding((a) => ({ ...a, [day]: { ...add, time: e.target.value } }))}
                  className="w-[150px] rounded-lg border border-[#cfd6de] px-2.5 py-1.5 text-sm" />
                <button type="submit" className="rounded-lg border border-navy px-3 py-1.5 text-sm font-semibold text-navy">Add</button>
              </form>
            </section>
          );
        })}
      </div>
    </div>
  );
}

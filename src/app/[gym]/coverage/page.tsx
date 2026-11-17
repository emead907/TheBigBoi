import { createClient } from '@/lib/supabase/server';
import { getGymContext } from '@/lib/gym';
import type { CoverageSlot } from '@/lib/coverage';
import { PageHeader } from '@/components/ui';
import CoverageBoard from '@/components/CoverageBoard';

export const dynamic = 'force-dynamic';

export default async function CoveragePage({ params }: { params: { gym: string } }) {
  const ctx = await getGymContext(params.gym);
  const { data, error } = await createClient()
    .from('coverage_slots')
    .select('*')
    .eq('gym_id', ctx.gym.id)
    .gte('day', ctx.today)
    .order('day')
    .order('start_min', { nullsFirst: false })
    .order('name');
  const slots = (data ?? []) as CoverageSlot[];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Temporary" title="Coverage"
        subtitle="Who's coaching each class and camp slot, who's out of town, and who's covering." />
      {error ? (
        <div className="card p-5 text-sm text-slate-brand">
          The coverage table isn&apos;t set up yet. Run <code>supabase/migrations/0013_coverage.sql</code> in the Supabase SQL Editor, then refresh.
        </div>
      ) : (
        <CoverageBoard slug={ctx.gym.slug} initial={slots} />
      )}
    </div>
  );
}

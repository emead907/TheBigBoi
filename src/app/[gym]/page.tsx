import { createClient } from '@/lib/supabase/server';
import { getGymContext } from '@/lib/gym';
import { stageOf, type Stage } from '@/lib/stages';
import { addDays } from '@/lib/dates';
import type { Trial } from '@/lib/types';
import TrialBoard from '@/components/TrialBoard';

export const dynamic = 'force-dynamic';

export default async function BoardPage({ params, searchParams }: { params: { gym: string }; searchParams: { stage?: string } }) {
  const ctx = await getGymContext(params.gym);
  const supabase = createClient();
  // Everything still open, plus anything closed in the last 60 days.
  const since = addDays(ctx.today, -60);
  const { data } = await supabase
    .from('trials')
    .select('*')
    .eq('gym_id', ctx.gym.id)
    .or(`status.eq.open,closed_at.gte.${since}`)
    .order('received_at', { ascending: false })
    .limit(1000);

  const trials = ((data ?? []) as Trial[]).map((t) => ({ ...t, stage: stageOf(t, ctx.today) as Stage }));
  const stage = (['waitlist', 'new', 'upcoming', 'today', 'follow_up', 'enrolled', 'closed'] as Stage[]).includes(searchParams.stage as Stage)
    ? (searchParams.stage as Stage)
    : trials.some((t) => t.stage === 'today') ? 'today' : 'new';

  return <TrialBoard slug={ctx.gym.slug} timezone={ctx.gym.timezone} today={ctx.today} trials={trials} initialStage={stage} canDelete={ctx.role === 'owner'} />;
}

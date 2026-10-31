import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getGymContext } from '@/lib/gym';
import { PageHeader } from '@/components/ui';
import { UserPlus } from '@/components/icons';
import TeamHub, { type TeamTab } from '@/components/TeamHub';
import type { TeamAthlete, TeamEntry, TeamExpense, TeamFee, TeamGroup, TeamMeet } from '@/lib/team';

export const dynamic = 'force-dynamic';
const TABS: TeamTab[] = ['overview', 'roster', 'meets', 'leos', 'schedule', 'fees'];

export default async function TeamPage({ params, searchParams }: { params: { gym: string }; searchParams: { tab?: string } }) {
  const ctx = await getGymContext(params.gym);
  const db = createClient();
  const isOwner = ctx.role === 'owner';
  const [{ data: athletes, error }, { data: meets }, { data: entries }, { data: groups }, fees, expenses] = await Promise.all([
    db.from('team_athletes').select('*').eq('gym_id', ctx.gym.id).eq('active', true).order('name'),
    db.from('team_meets').select('*').eq('gym_id', ctx.gym.id).order('start_date', { nullsFirst: false }),
    db.from('team_entries').select('meet_id, athlete_id').eq('gym_id', ctx.gym.id),
    db.from('team_groups').select('*').eq('gym_id', ctx.gym.id).order('sort'),
    isOwner ? db.from('team_fees').select('*').eq('gym_id', ctx.gym.id) : Promise.resolve({ data: [] }),
    isOwner ? db.from('team_expenses').select('*').eq('gym_id', ctx.gym.id).order('sort') : Promise.resolve({ data: [] }),
  ]);
  const tab = TABS.includes(searchParams.tab as TeamTab) && (searchParams.tab !== 'fees' || isOwner) ? (searchParams.tab as TeamTab) : 'overview';

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Competition team" title="Team" subtitle="Roster, meets, paperwork, leos and practice groups."
        right={<Link href={`/${ctx.gym.slug}/team/new`} className="btn-ghost rounded-xl"><UserPlus className="h-4 w-4" />Add athlete</Link>} />
      {error ? (
        <div className="card p-8 text-sm text-red-700">The team tables aren&rsquo;t set up yet. Run the team SQL in Supabase, then refresh. ({error.message})</div>
      ) : (
        <TeamHub slug={ctx.gym.slug} today={ctx.today} isOwner={isOwner} initialTab={tab}
          athletes={(athletes ?? []) as TeamAthlete[]} meets={(meets ?? []) as TeamMeet[]} entries={(entries ?? []) as TeamEntry[]}
          groups={(groups ?? []) as TeamGroup[]} fees={(fees.data ?? []) as TeamFee[]} expenses={(expenses.data ?? []) as TeamExpense[]} />
      )}
    </div>
  );
}

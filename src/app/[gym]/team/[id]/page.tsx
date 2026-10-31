import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getGymContext } from '@/lib/gym';
import { Avatar } from '@/components/ui';
import { ArrowLeft } from '@/components/icons';
import AthleteEditor from '@/components/AthleteEditor';
import type { TeamAthlete, TeamFee, TeamGroup, TeamMeet } from '@/lib/team';

export const dynamic = 'force-dynamic';

export default async function AthletePage({ params }: { params: { gym: string; id: string } }) {
  const ctx = await getGymContext(params.gym);
  const db = createClient();
  const isOwner = ctx.role === 'owner';
  const [{ data: a }, { data: meets }, { data: entries }, { data: groups }, { data: fee }] = await Promise.all([
    db.from('team_athletes').select('*').eq('id', params.id).eq('gym_id', ctx.gym.id).maybeSingle(),
    db.from('team_meets').select('*').eq('gym_id', ctx.gym.id).order('start_date', { nullsFirst: false }),
    db.from('team_entries').select('meet_id').eq('athlete_id', params.id),
    db.from('team_groups').select('*').eq('gym_id', ctx.gym.id).order('sort'),
    isOwner ? db.from('team_fees').select('*').eq('athlete_id', params.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!a) notFound();
  const athlete = a as TeamAthlete;
  return (
    <div className="space-y-6">
      <Link href={`/${ctx.gym.slug}/team?tab=roster`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline"><ArrowLeft className="h-4 w-4" /> Back to team</Link>
      <div className="flex items-center gap-4">
        <Avatar name={athlete.name} size="lg" />
        <div>
          <div className="eyebrow">Team athlete</div>
          <h1 className="display text-[44px] leading-[0.95]">{athlete.name}</h1>
          <p className="mt-1 text-sm text-slate-brand">{[athlete.level, athlete.group_name, athlete.hours ? `${athlete.hours} hrs/week` : ''].filter(Boolean).join(' · ') || 'No level yet'}</p>
        </div>
      </div>
      <AthleteEditor slug={ctx.gym.slug} athlete={athlete} isOwner={isOwner} meets={(meets ?? []) as TeamMeet[]}
        signedUp={(entries ?? []).map((e) => e.meet_id as string)} groups={(groups ?? []) as TeamGroup[]} fee={(fee ?? null) as TeamFee | null} />
    </div>
  );
}

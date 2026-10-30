import { createClient } from '@/lib/supabase/server';
import { getGymContext } from '@/lib/gym';
import { addDays } from '@/lib/dates';
import { partyStage, type Party, type PartyStage } from '@/lib/parties';
import PartyBoard from '@/components/PartyBoard';

export const dynamic = 'force-dynamic';

export default async function PartiesPage({ params, searchParams }: { params: { gym: string }; searchParams: { stage?: string } }) {
  const ctx = await getGymContext(params.gym);
  const { data } = await createClient().from('parties').select('*').eq('gym_id', ctx.gym.id)
    .or(`status.in.(inquiry,booked),party_date.gte.${addDays(ctx.today, -120)},received_at.gte.${addDays(ctx.today, -120)}`)
    .order('party_date', { ascending: true, nullsFirst: false }).limit(2000);
  const parties = ((data ?? []) as Party[]).map((p) => ({ ...p, stage: partyStage(p, ctx.today) }));
  const valid: PartyStage[] = ['inquiry', 'upcoming', 'past', 'closed'];
  const stage = valid.includes(searchParams.stage as PartyStage) ? (searchParams.stage as PartyStage) : 'inquiry';
  return <PartyBoard slug={ctx.gym.slug} today={ctx.today} timezone={ctx.gym.timezone} parties={parties} initialStage={stage} canDelete={ctx.role === 'owner'} />;
}

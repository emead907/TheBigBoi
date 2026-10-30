import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getGymContext } from '@/lib/gym';
import { formatDateTime, formatDay } from '@/lib/dates';
import { conflicts, partyStage, type Party } from '@/lib/parties';
import type { Activity } from '@/lib/types';
import { Avatar, Card } from '@/components/ui';
import { ArrowLeft } from '@/components/icons';
import PartyEditor from '@/components/PartyEditor';

export const dynamic = 'force-dynamic';

export default async function PartyPage({ params }: { params: { gym: string; id: string } }) {
  const ctx = await getGymContext(params.gym);
  const db = createClient();
  const { data } = await db.from('parties').select('*').eq('id', params.id).eq('gym_id', ctx.gym.id).maybeSingle();
  if (!data) notFound();
  const party = data as Party;
  const [{ data: same }, { data: acts }] = await Promise.all([
    party.party_date ? db.from('parties').select('id, party_date, time_slot, status, child_name, parent_name').eq('gym_id', ctx.gym.id).eq('party_date', party.party_date) : Promise.resolve({ data: [] }),
    db.from('activity').select('*').eq('party_id', party.id).order('created_at', { ascending: false }).limit(60),
  ]);
  const sameDay = (same ?? []) as (Pick<Party, 'id' | 'party_date' | 'time_slot' | 'status'> & { child_name: string | null; parent_name: string | null })[];
  const clash = conflicts(party, sameDay);
  const stage = partyStage(party, ctx.today);
  const title = party.child_name ? `${party.child_name}'s Party` : party.parent_name ? `${party.parent_name}'s Party` : 'Birthday Party';

  return (
    <div className="space-y-6">
      <Link href={`/${ctx.gym.slug}/parties?stage=${stage}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline"><ArrowLeft className="h-4 w-4" /> Back to parties</Link>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={party.child_name || party.parent_name || '?'} size="lg" />
        <div>
          <div className="eyebrow">Birthday party</div>
          <h1 className="display text-[44px] leading-[0.95]">{title}</h1>
          <p className="mt-1 text-sm text-slate-brand">
            {party.party_date ? `${formatDay(party.party_date, { year: true })}${party.time_slot ? `, ${party.time_slot}` : ''}` : 'No date yet'} · requested {formatDateTime(party.received_at, ctx.gym.timezone)} via {party.source}
          </p>
        </div>
      </div>
      {clash.length > 0 && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Double booking:</strong> this time is already booked for{' '}
          {clash.map((c, i) => <Link key={c.id} className="font-semibold underline" href={`/${ctx.gym.slug}/parties/${c.id}`}>{i ? ', ' : ''}{sameDay.find((s) => s.id === c.id)?.child_name || sameDay.find((s) => s.id === c.id)?.parent_name || 'another party'}</Link>)}.
        </p>
      )}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <PartyEditor slug={ctx.gym.slug} party={party} isOwner={ctx.role === 'owner'} />
        <div className="min-w-0 space-y-5">
          {party.comments && <Card eyebrow="From the family" title="Their message"><p className="whitespace-pre-line text-sm">{party.comments}</p></Card>}
          <Card eyebrow="Latest updates" title="Activity">
            {(acts ?? []).length === 0 ? <p className="text-sm text-slate-brand">Nothing yet.</p> : (
              <ul className="space-y-3">{((acts ?? []) as Activity[]).map((a) => (
                <li key={a.id} className="text-sm"><div><strong>{a.actor}</strong> · {a.detail}</div><div className="text-xs text-slate-brand">{formatDateTime(a.created_at, ctx.gym.timezone)}</div></li>
              ))}</ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

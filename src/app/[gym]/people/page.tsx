import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getGymContext } from '@/lib/gym';
import { PageHeader } from '@/components/ui';
import PeopleDirectory, { type DirAccount, type DirReg } from '@/components/PeopleDirectory';
import { UserPlus } from '@/components/icons';

export const dynamic = 'force-dynamic';

export default async function PeoplePage({ params, searchParams }: { params: { gym: string }; searchParams: { tab?: string } }) {
  const ctx = await getGymContext(params.gym);
  const db = createClient();
  const accounts: DirAccount[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from('accounts')
      .select('id, first_name, last_name, email, mobile, phone, sms_status, status, members(id, first_name, last_name, birthday, gender, classes, bookings, status)')
      .eq('gym_id', ctx.gym.id).order('last_name').order('first_name').range(from, from + 999);
    accounts.push(...((data ?? []) as unknown as DirAccount[]));
    if (!data || data.length < 1000) break;
  }
  // Class registrations (from GoMotion's New Registrations report), attached to each athlete.
  const regs: (DirReg & { member_id: string | null })[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from('registrations').select('member_id, class_name, slot, start_date, drop_date, waitlisted')
      .eq('gym_id', ctx.gym.id).range(from, from + 999);
    regs.push(...((data ?? []) as (DirReg & { member_id: string | null })[]));
    if (!data || data.length < 1000) break;
  }
  const regsByMember = new Map<string, DirReg[]>();
  regs.forEach((r) => r.member_id && regsByMember.set(r.member_id, [...(regsByMember.get(r.member_id) ?? []), r]));
  accounts.forEach((a) => a.members.forEach((m) => { m.regs = regsByMember.get(m.id) ?? []; }));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Families & athletes" title="People" subtitle="Everyone with an account at the gym, and the athletes on each account."
        right={ctx.role === 'owner' ? <Link href={`/${ctx.gym.slug}/people/import`} className="btn-ghost rounded-xl"><UserPlus className="h-4 w-4" />Import from GoMotion</Link> : undefined} />
      {accounts.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="display text-2xl">No people yet</div>
          <p className="mt-1 text-sm text-slate-brand">Import a GoMotion account export to fill in your families and athletes.</p>
          {ctx.role === 'owner' && <Link href={`/${ctx.gym.slug}/people/import`} className="btn-primary mt-4 rounded-xl">Import people</Link>}
        </div>
      ) : (
        <PeopleDirectory slug={ctx.gym.slug} today={ctx.today} accounts={accounts} useRegs={regs.length > 0} initialTab={searchParams.tab === 'athletes' ? 'athletes' : 'families'} />
      )}
    </div>
  );
}

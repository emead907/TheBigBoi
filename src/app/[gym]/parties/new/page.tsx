import { getGymContext } from '@/lib/gym';
import { PageHeader } from '@/components/ui';
import NewPartyForm from '@/components/NewPartyForm';

export default async function NewPartyPage({ params }: { params: { gym: string } }) {
  const ctx = await getGymContext(params.gym);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`Parties · ${ctx.gym.short_name}`} title="Add a party" subtitle="For phone calls, walk-ins and emails. Website requests come in on their own." />
      <NewPartyForm slug={ctx.gym.slug} />
    </div>
  );
}

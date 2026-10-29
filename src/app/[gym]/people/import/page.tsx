import { redirect } from 'next/navigation';
import { getGymContext } from '@/lib/gym';
import { PageHeader } from '@/components/ui';
import PeopleImport from '@/components/PeopleImport';

export default async function ImportPage({ params }: { params: { gym: string } }) {
  const ctx = await getGymContext(params.gym);
  if (ctx.role !== 'owner') redirect(`/${ctx.gym.slug}/people`);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={`People · ${ctx.gym.short_name}`} title="Import from GoMotion" subtitle="Upload an account export. Re-importing updates existing families and athletes instead of adding duplicates." />
      <PeopleImport slug={ctx.gym.slug} gymName={ctx.gym.short_name} />
    </div>
  );
}

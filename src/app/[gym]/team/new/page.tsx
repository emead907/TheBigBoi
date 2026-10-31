import Link from 'next/link';
import { getGymContext } from '@/lib/gym';
import { PageHeader } from '@/components/ui';
import { ArrowLeft } from '@/components/icons';
import { NewAthleteForm } from '@/components/AthleteEditor';

export default async function NewAthletePage({ params }: { params: { gym: string } }) {
  const ctx = await getGymContext(params.gym);
  return (
    <div className="space-y-6">
      <Link href={`/${ctx.gym.slug}/team?tab=roster`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline"><ArrowLeft className="h-4 w-4" /> Back to team</Link>
      <PageHeader eyebrow="Competition team" title="Add athlete" />
      <NewAthleteForm slug={ctx.gym.slug} />
    </div>
  );
}

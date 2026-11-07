import { notFound } from 'next/navigation';
import { getGymContext } from '@/lib/gym';
import { atLocation, fetchClasses } from '@/lib/jackrabbit';
import { PageHeader } from '@/components/ui';
import ClassFill from '@/components/ClassFill';

export const revalidate = 600;

export default async function ClassesPage({ params }: { params: { gym: string } }) {
  const ctx = await getGymContext(params.gym);
  const orgId = ctx.gym.jackrabbit_org_id;
  if (!orgId) notFound();
  const res = await fetchClasses(orgId);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="From Jackrabbit" title="Classes" subtitle="Open spots in every class, straight from Jackrabbit. Updates about every 10 minutes." />
      {res.ok && ctx.gym.jackrabbit_location && atLocation(res.classes, ctx.gym.jackrabbit_location).length === 0 && res.classes.length > 0 && (
        <div className="card p-5 text-sm text-[#8a5300]">
          No classes matched the location &ldquo;{ctx.gym.jackrabbit_location}&rdquo;. Jackrabbit lists these locations: {[...new Set(res.classes.map((c) => c.location || c.locationCode).filter(Boolean))].join(', ') || 'none'}. Update the location in Settings to match one of them.
        </div>
      )}
      {res.ok
        ? <ClassFill classes={atLocation(res.classes, ctx.gym.jackrabbit_location)} />
        : <div className="card p-8 text-sm text-red-700">Couldn&rsquo;t load classes from Jackrabbit (org {orgId}). {res.error}</div>}
    </div>
  );
}

import { getGymContext } from '@/lib/gym';
import NewRequestForm from '@/components/NewRequestForm';

export default async function NewRequestPage({ params }: { params: { gym: string } }) {
  const ctx = await getGymContext(params.gym);
  return (
    <div className="space-y-4">
      <div>
        <div className="eyebrow">{ctx.gym.short_name}</div>
        <h1 className="display text-4xl">Add a request</h1>
        <p className="text-sm text-slate-brand">Paste a class request email to fill this in, or type it in for a phone call or walk-in.</p>
      </div>
      <NewRequestForm slug={ctx.gym.slug} />
    </div>
  );
}

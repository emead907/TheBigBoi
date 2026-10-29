import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function Home() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data } = await supabase.from('memberships').select('gyms(slug, name)').eq('user_id', user.id);
  const slugs = (data ?? [])
    .map((m) => (m as unknown as { gyms: { slug: string; name: string } }).gyms)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (slugs.length === 0) redirect('/no-access');
  redirect(`/${slugs[0].slug}`);
}

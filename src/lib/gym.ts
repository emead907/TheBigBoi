import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import type { Gym, Membership } from './types';
import { ymdInZone } from './dates';

export interface GymContext {
  gym: Gym;
  gyms: Gym[];
  role: Membership['role'];
  userId: string;
  actor: string;
  today: string;
}

/** Loads the signed-in staff member, their gyms, and the gym in the URL. */
export async function getGymContext(slug: string): Promise<GymContext> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('memberships')
    .select('role, display_name, gym_id, gyms(*)')
    .eq('user_id', user.id);
  const memberships = (data ?? []) as unknown as (Membership & { gyms: Gym })[];
  if (memberships.length === 0) redirect('/no-access');

  const current = memberships.find((m) => m.gyms.slug === slug);
  if (!current) notFound();

  return {
    gym: current.gyms,
    gyms: memberships.map((m) => m.gyms).sort((a, b) => a.name.localeCompare(b.name)),
    role: current.role,
    userId: user.id,
    actor: current.display_name || user.email?.split('@')[0] || 'Staff',
    today: ymdInZone(new Date(), current.gyms.timezone),
  };
}

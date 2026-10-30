import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getGymContext } from '@/lib/gym';
import { PARTY_KEYS, TRIAL_KEYS, type Template } from '@/lib/types';
import { TEMPLATE_LABEL } from '@/lib/messaging';
import { GymForm, TemplateForm, IntakeBox, StaffPanel } from '@/components/SettingsForms';

export const dynamic = 'force-dynamic';

export default async function SettingsPage({ params }: { params: { gym: string } }) {
  const ctx = await getGymContext(params.gym);
  if (ctx.role !== 'owner') redirect(`/${ctx.gym.slug}`);
  const supabase = createClient();
  const [{ data: tpls }, { data: members }] = await Promise.all([
    supabase.from('templates').select('*').eq('gym_id', ctx.gym.id),
    supabase.from('memberships').select('user_id, role, display_name').eq('gym_id', ctx.gym.id),
  ]);
  let emails: Record<string, string> = {};
  try {
    const { data } = await createAdminClient().auth.admin.listUsers({ perPage: 1000 });
    emails = Object.fromEntries(data.users.map((u) => [u.id, u.email ?? '']));
  } catch { /* service key missing; show names only */ }

  const templates = (tpls ?? []) as Template[];
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? '';

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow">{ctx.gym.short_name}</div>
        <h1 className="display text-4xl">Settings</h1>
      </div>

      <GymForm slug={ctx.gym.slug} gym={ctx.gym} />

      <section className="space-y-3">
        <div>
          <h2 className="display text-3xl">Messages</h2>
          <p className="text-sm text-slate-brand">
            Placeholders: {'{{parent_first}} {{child_first}} {{class}} {{requested_time}} {{first_day}} {{first_day_time}} {{gym_name}} {{gym_phone}} {{portal_link}}'}.
            Turn on <strong>Send automatically</strong> to have the reminder go out the evening before a first day, the follow-up the evening after,
            and follow-up 2 two days after (only for kids marked as showing up, and not for families marked not enrolling).
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {TRIAL_KEYS.flatMap((key) => (['email', 'sms'] as const).map((channel) => {
            const t = templates.find((x) => x.key === key && x.channel === channel);
            return <TemplateForm key={`${key}-${channel}`} slug={ctx.gym.slug} k={key} channel={channel}
              label={TEMPLATE_LABEL[key]} template={t ?? null} canAuto={key !== 'spot_ready'} />;
          }))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="display text-3xl">Party emails</h2>
          <p className="text-sm text-slate-brand">
            Placeholders: {'{{parent_first}} {{child_first}} {{party_date}} {{time_slot}} {{num_children}} {{price}} {{amount_paid}} {{balance}} {{gym_name}} {{gym_phone}} {{waiver_link}}'}.
            Party emails send from the party&rsquo;s page. With <strong>Send automatically</strong> on, the reminder goes out 3 days before a booked party
            and the thank-you the day after.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {PARTY_KEYS.map((key) => (
            <TemplateForm key={key} slug={ctx.gym.slug} k={key} channel="email" label={TEMPLATE_LABEL[key]}
              template={templates.find((x) => x.key === key && x.channel === 'email') ?? null}
              canAuto={key === 'party_reminder' || key === 'party_thank_you'} />
          ))}
        </div>
      </section>

      <IntakeBox slug={ctx.gym.slug} endpoint={`${site}/api/intake/${ctx.gym.slug}`} intakeKey={ctx.gym.intake_key} />

      <StaffPanel slug={ctx.gym.slug} me={ctx.userId}
        gyms={ctx.gyms.map((g) => ({ id: g.id, name: g.short_name }))} currentGymId={ctx.gym.id}
        members={(members ?? []).map((m) => ({ ...m, email: emails[m.user_id] ?? '' }))} />
    </div>
  );
}

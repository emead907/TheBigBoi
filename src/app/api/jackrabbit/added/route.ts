import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { safeEqual } from '@/lib/jackrabbit-sync';

/**
 * Zapier reports back after "Add to Jackrabbit".
 * POST /api/jackrabbit/added with header `x-intake-key: <that hub's key>` and JSON:
 * { gym, trial_id, ok, family_id, family_status: 'created'|'found'|'duplicate', student_added, error }
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Send JSON.' }, { status: 400 }); }
  const s = (k: string) => (body[k] == null ? '' : String(body[k]).trim().slice(0, 300));

  const db = createAdminClient();
  const { data: gym } = await db.from('gyms').select('id, intake_key, jackrabbit_location').eq('slug', s('gym')).maybeSingle();
  const key = request.headers.get('x-intake-key') ?? '';
  if (!gym || !safeEqual(key, gym.intake_key)) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

  const { data: trial } = await db.from('trials').select('id').eq('id', s('trial_id')).eq('gym_id', gym.id).maybeSingle();
  if (!trial) return NextResponse.json({ error: 'Request not found.' }, { status: 404 });

  const ok = body.ok === true || body.ok === 'true';
  if (!ok) {
    await db.from('activity').insert({ gym_id: gym.id, trial_id: trial.id, actor: 'Jackrabbit', kind: 'message_failed', detail: `Couldn't add to Jackrabbit: ${s('error') || 'unknown error'}` });
    return NextResponse.json({ ok: true });
  }

  await db.from('trials').update({ in_sportsengine: true }).eq('id', trial.id);
  const fam = s('family_id');
  const how = s('family_status') === 'created'
    ? `new family ${fam}. Set the family's location to ${gym.jackrabbit_location ?? 'this gym'} in Jackrabbit`
    : `added to existing family ${fam}`;
  const student = body.student_added === false || body.student_added === 'false' ? ' (child was already on the account)' : '';
  await db.from('activity').insert({ gym_id: gym.id, trial_id: trial.id, actor: 'Jackrabbit', kind: 'update', detail: `Added to Jackrabbit: ${how}${student}` });
  return NextResponse.json({ ok: true });
}

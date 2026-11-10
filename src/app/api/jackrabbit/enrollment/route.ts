import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDay } from '@/lib/dates';
import { jackrabbitSyncOn, niceTime, safeEqual } from '@/lib/jackrabbit-sync';

/**
 * Jackrabbit enrollments (Zapier "Student Enrolled" trigger).
 * POST /api/jackrabbit/enrollment (optional header `x-intake-key: <hub key>`) with JSON:
 * { org_id, location, class_name, first_class_date, start_time, family_id, emails: [..], child_first, child_last, child_birthday }
 * Finds the open request for that family and child at the hub for that location, and schedules it:
 * first day = the student's first class date, time = the class start time, marked as in Jackrabbit.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Send JSON.' }, { status: 400 }); }
  const s = (k: string) => (body[k] == null ? '' : String(body[k]).trim().slice(0, 300));

  const db = createAdminClient();
  const orgId = s('org_id');
  if (!orgId) return NextResponse.json({ error: 'org_id is required.' }, { status: 422 });
  const { data: gyms } = await db.from('gyms').select('id, slug, intake_key, jackrabbit_location').eq('jackrabbit_org_id', orgId);
  if (!gyms?.length) return NextResponse.json({ error: 'Unknown Jackrabbit account.' }, { status: 404 });
  // A hub key is optional here. Without one, this can only fill in a first day on a request
  // that doesn't have one yet, for a family whose email and child already match that request.
  const key = request.headers.get('x-intake-key') ?? '';
  const trusted = !!key && gyms.some((g) => safeEqual(key, g.intake_key));

  const location = s('location');
  const gym = gyms.find((g) => (g.jackrabbit_location ?? '').toLowerCase() === location.toLowerCase());
  if (!gym) return NextResponse.json({ ok: true, skipped: `No hub for the Jackrabbit location "${location}".` });
  if (!jackrabbitSyncOn(gym.slug)) return NextResponse.json({ ok: true, skipped: 'Jackrabbit sync is not turned on for this hub yet.' });

  const emails = (Array.isArray(body.emails) ? body.emails : [body.email])
    .map((e) => String(e ?? '').trim().toLowerCase()).filter((e) => e.includes('@'));
  const childFirst = s('child_first').toLowerCase();
  const childBirthday = s('child_birthday').slice(0, 10);
  if (!emails.length || !childFirst) return NextResponse.json({ ok: true, skipped: 'No email or child name to match on.' });

  const { data: open } = await db.from('trials')
    .select('id, child_name, birthday, parent_email, first_day, first_day_time, class_name')
    .eq('gym_id', gym.id).eq('status', 'open').in('parent_email', emails)
    .order('received_at', { ascending: false });
  // Also match emails saved with different capitalization.
  let candidates = open ?? [];
  if (!candidates.length) {
    const { data: all } = await db.from('trials')
      .select('id, child_name, birthday, parent_email, first_day, first_day_time, class_name')
      .eq('gym_id', gym.id).eq('status', 'open').order('received_at', { ascending: false }).limit(500);
    candidates = (all ?? []).filter((t) => emails.includes((t.parent_email ?? '').toLowerCase()));
  }
  const match =
    candidates.find((t) => (t.child_name ?? '').toLowerCase().split(/\s+/)[0] === childFirst.split(/\s+/)[0]) ??
    candidates.find((t) => childBirthday && t.birthday === childBirthday) ??
    (candidates.length === 1 ? candidates[0] : undefined);
  if (!match) return NextResponse.json({ ok: true, skipped: 'No open request matches this family.' });

  const firstDay = s('first_class_date').slice(0, 10);
  const time = niceTime(s('start_time'));
  if (!trusted && match.first_day) return NextResponse.json({ ok: true, skipped: 'This request already has a first day.' });
  const patch: Record<string, unknown> = { in_sportsengine: true };
  if (/^\d{4}-\d{2}-\d{2}$/.test(firstDay)) {
    patch.first_day = firstDay;
    if (match.first_day !== firstDay) patch.reminder_sent_at = null;
  }
  if (time) patch.first_day_time = time;
  if (!match.class_name && s('class_name')) patch.class_name = s('class_name');

  const { error } = await db.from('trials').update(patch).eq('id', match.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await db.from('activity').insert({
    gym_id: gym.id, trial_id: match.id, actor: 'Jackrabbit', kind: 'update',
    detail: `Enrolled in Jackrabbit: ${s('class_name') || 'class'}${patch.first_day ? `, first day ${formatDay(firstDay)}${time ? ` at ${time}` : ''}` : ''}`,
  });
  return NextResponse.json({ ok: true, scheduled: match.id });
}

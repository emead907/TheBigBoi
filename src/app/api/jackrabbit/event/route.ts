import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatPhone } from '@/lib/parse';
import { partyRules, slotForTimes } from '@/lib/parties';

/**
 * Jackrabbit event bookings (from the Zapier "Student Enrolled in Event" trigger).
 * POST /api/jackrabbit/event with header `x-intake-key: <intake key of any hub on this Jackrabbit account>` and JSON:
 * { org_id, enrollment_id, event_id, event_name, category, location, event_date, start_time, end_time,
 *   family_name, parent_first, parent_last, email, phone, child_first, child_birthday }
 * Birthday parties go to the Parties board of the hub for that location (Nampa or Eagle). Other events are ignored.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Send JSON.' }, { status: 400 }); }
  const s = (k: string) => { const v = body[k]; return v == null ? '' : String(v).trim().slice(0, 300); };

  const db = createAdminClient();
  const orgId = s('org_id');
  if (!orgId) return NextResponse.json({ error: 'org_id is required.' }, { status: 422 });
  const { data: gyms } = await db.from('gyms').select('id, slug, intake_key, jackrabbit_org_id, jackrabbit_location').eq('jackrabbit_org_id', orgId);
  const key = request.headers.get('x-intake-key') ?? request.nextUrl.searchParams.get('key') ?? '';
  if (!gyms?.length || !gyms.some((g) => safeEqual(key, g.intake_key))) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

  const isParty = /birthday|party/i.test(`${s('category')} ${s('event_name')}`);
  if (!isParty) return NextResponse.json({ ok: true, skipped: 'Not a birthday party.' });

  const location = s('location');
  const gym = gyms.find((g) => (g.jackrabbit_location ?? '').toLowerCase() === location.toLowerCase());
  if (!gym) return NextResponse.json({ error: `No hub is set up for the Jackrabbit location "${location}".` }, { status: 422 });

  const date = s('event_date').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'event_date is required (YYYY-MM-DD).' }, { status: 422 });
  const start = s('start_time'); const end = s('end_time');
  const rules = partyRules(gym);

  // Age they're turning, if we know the child's birthday.
  let childAge: string | null = null;
  const dob = s('child_birthday').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    const age = Number(date.slice(0, 4)) - Number(dob.slice(0, 4));
    childAge = String(dob.slice(5) > date.slice(5) && Number(dob.slice(5, 7)) - Number(date.slice(5, 7)) > 2 ? age - 1 : age);
  }
  const parent = [s('parent_first'), s('parent_last') || s('family_name')].filter(Boolean).join(' ') || (s('family_name') ? `${s('family_name')} family` : null);

  const row = {
    gym_id: gym.id, source: 'manual', status: 'booked',
    // Same key the one-time import used, so a party already on the board isn't added twice.
    external_id: `jr-event:${location}:${date}:${start.replace(/\s/g, '').toLowerCase()}`,
    parent_name: parent, parent_email: s('email').toLowerCase() || null, parent_phone: s('phone') ? formatPhone(s('phone')) : null,
    child_name: s('child_first') || null, child_age: childAge,
    party_date: date, time_slot: slotForTimes(rules, date, start, end), package: 'party_room',
    notes: `Booked in Jackrabbit: ${s('event_name') || 'Birthday party'} (${start}${end ? `–${end}` : ''}), ${location}.`,
  };
  const { data, error } = await db.from('parties').upsert(row, { onConflict: 'gym_id,external_id', ignoreDuplicates: true }).select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ ok: true, created: 0, note: 'Already on the board.' });
  await db.from('activity').insert({ gym_id: gym.id, party_id: data[0].id, actor: 'Jackrabbit', kind: 'created', detail: 'Party booked in Jackrabbit' });
  return NextResponse.json({ ok: true, created: 1, hub: gym.slug });
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

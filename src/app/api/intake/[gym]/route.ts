import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatPhone, parseDateLoose } from '@/lib/parse';

/**
 * Website class-request intake.
 * POST /api/intake/<gym-slug> with header `x-intake-key: <key from Settings>` and JSON (or form) body:
 * { class, requested_time, parent, email, phone, zip, sms_opt_in, children: [{ name, birthday }], id? }
 * Call it from your website's server code (where the key stays private), not from the browser.
 */
export async function POST(request: NextRequest, { params }: { params: { gym: string } }) {
  const db = createAdminClient();
  const { data: gym } = await db.from('gyms').select('id, intake_key').eq('slug', params.gym).maybeSingle();
  const key = request.headers.get('x-intake-key') ?? request.nextUrl.searchParams.get('key') ?? '';
  if (!gym || !safeEqual(key, gym.intake_key)) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = request.headers.get('content-type')?.includes('application/json')
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());
  } catch {
    return NextResponse.json({ error: 'Could not read the request body.' }, { status: 400 });
  }

  const s = (...keys: string[]) => {
    for (const k of keys) {
      const v = body[k];
      if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 300);
    }
    return null;
  };
  let children: { name: string; birthday: string | null }[] = [];
  if (Array.isArray(body.children)) {
    children = (body.children as Record<string, unknown>[])
      .map((c) => ({ name: String(c?.name ?? c?.child_name ?? '').trim().slice(0, 120), birthday: parseDateLoose(String(c?.birthday ?? '')) }))
      .filter((c) => c.name);
  } else if (s('child', 'child_name')) {
    children = [{ name: s('child', 'child_name')!, birthday: parseDateLoose(s('birthday') ?? '') }];
  }
  if (children.length === 0) return NextResponse.json({ error: 'At least one child name is required.' }, { status: 422 });
  if (children.length > 8) children = children.slice(0, 8);

  const optIn = body.sms_opt_in === true || body.sms_opt_in === 'true' || body.sms_opt_in === 'on';
  const externalId = s('id', 'external_id');
  const rows = children.map((c, i) => ({
    gym_id: gym.id,
    source: 'website' as const,
    child_name: c.name,
    birthday: c.birthday,
    class_name: s('class', 'class_name'),
    requested_time: s('requested_time', 'time'),
    parent_name: s('parent', 'parent_name'),
    parent_email: s('email', 'parent_email'),
    parent_phone: s('phone', 'parent_phone') ? formatPhone(s('phone', 'parent_phone')!) : null,
    zip: s('zip'),
    sms_opt_in: optIn,
    notes: s('notes', 'message'),
    external_id: externalId ? `${externalId}-${i + 1}` : null,
  }));

  const { data, error } = await db.from('trials').upsert(rows, { onConflict: 'gym_id,external_id', ignoreDuplicates: true }).select('id');
  if (error) {
    // Partial unique index can't be targeted by upsert on some setups; fall back to a plain insert.
    const retry = await db.from('trials').insert(rows).select('id');
    if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 });
    await logCreated(db, gym.id, retry.data ?? []);
    return NextResponse.json({ ok: true, created: retry.data?.length ?? 0 });
  }
  await logCreated(db, gym.id, data ?? []);
  return NextResponse.json({ ok: true, created: data?.length ?? 0 });
}

async function logCreated(db: ReturnType<typeof createAdminClient>, gymId: string, rows: { id: string }[]) {
  if (!rows.length) return;
  await db.from('activity').insert(rows.map((r) => ({ gym_id: gymId, trial_id: r.id, actor: 'Website', kind: 'created', detail: 'Request came in from the website' })));
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

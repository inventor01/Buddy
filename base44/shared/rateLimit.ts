// Small server-side quota guard for public LLM-backed endpoints.
// Stores only a SHA-256-derived bucket key — never a raw IP address.

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function clientHint(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown';
  const ua = (req.headers.get('user-agent') || '').slice(0, 120);
  return `${ip}|${ua}`;
}

async function bump(base44: any, key: string, limit: number, expiresAt: Date) {
  const rows = await base44.asServiceRole.entities.UsageBucket.filter({ bucket_key: key }, '-created_date', 1);
  const row = Array.isArray(rows) ? rows[0] : null;
  const now = Date.now();
  if (row && Date.parse(row.expires_at || '') > now) {
    const count = Number(row.count || 0);
    if (count >= limit) return false;
    await base44.asServiceRole.entities.UsageBucket.update(row.id, { count: count + 1 });
    return true;
  }
  if (row?.id) {
    try { await base44.asServiceRole.entities.UsageBucket.delete(row.id); } catch (_) {}
  }
  await base44.asServiceRole.entities.UsageBucket.create({
    bucket_key: key,
    count: 1,
    expires_at: expiresAt.toISOString(),
  });
  return true;
}

export async function checkUsageLimit({ base44, req, scope, minuteLimit, dayLimit }: any) {
  let userId = '';
  try {
    const me = await base44.auth.me();
    userId = me?.id || '';
  } catch (_) {}

  const rawIdentity = userId ? `user:${userId}` : `anon:${clientHint(req)}`;
  const identity = await sha256(rawIdentity);
  const now = new Date();
  const minuteStamp = now.toISOString().slice(0, 16);
  const dayStamp = now.toISOString().slice(0, 10);
  const minuteExpiry = new Date(now.getTime() + 2 * 60 * 1000);
  const dayExpiry = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2));

  const minuteOk = await bump(base44, `${scope}:m:${minuteStamp}:${identity}`, minuteLimit, minuteExpiry);
  if (!minuteOk) return { ok: false, retryAfter: 60 };
  const dayOk = await bump(base44, `${scope}:d:${dayStamp}:${identity}`, dayLimit, dayExpiry);
  if (!dayOk) return { ok: false, retryAfter: 3600 };
  return { ok: true };
}

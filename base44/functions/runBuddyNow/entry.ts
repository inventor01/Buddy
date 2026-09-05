import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { runBuddy } from '../../shared/runBuddy.ts';

// "Run now" — runs one of the signed-in user's own buddies immediately,
// pins the findings back, and emails them if they've opted in.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (e) { body = {}; }
    const buddyId = typeof body?.buddyId === 'string' ? body.buddyId : '';
    if (!buddyId) return Response.json({ error: 'Which buddy should run?' }, { status: 400 });

    const buddy = await base44.entities.Buddy.get(buddyId);
    if (!buddy || buddy.created_by_id !== user.id) {
      return Response.json({ error: 'That buddy is not yours' }, { status: 403 });
    }

    const result = await runBuddy({
      client: base44,
      entityClient: base44,
      buddy,
      userEmail: user.email,
      notifyEmail: !!user.notify_email,
      smsPhone: typeof user.sms_phone === 'string' ? user.sms_phone : ''
    });

    return Response.json({ lines: result.lines, items: result.items });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
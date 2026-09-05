import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { runBuddy, parseScheduleHour } from '../../shared/runBuddy.ts';

// Hourly sweep: runs every active buddy whose schedule time has arrived and
// that hasn't already run today. Triggered by the platform's scheduler.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // Scheduled automations arrive without a user token. A signed-in user
    // invoking this directly would run other people's buddies — refuse.
    let user = null;
    try { user = await base44.auth.me(); } catch (e) { user = null; }
    if (user) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const buddies = await base44.asServiceRole.entities.Buddy.filter(
      { status: 'active' },
      '-created_date',
      100
    );

    const today = new Date().toISOString().slice(0, 10);
    const currentHour = new Date().getHours();

    const due = buddies
      .filter((b) => parseScheduleHour(b.schedule_time) === currentHour && b.last_run_date !== today)
      .slice(0, 25);

    const results = [];
    for (const buddy of due) {
      try {
        let owner = null;
        try {
          owner = await base44.asServiceRole.entities.User.get(buddy.created_by_id);
        } catch (e) {
          owner = null;
        }
        const lines = await runBuddy({
          client: base44,
          entityClient: base44.asServiceRole,
          buddy,
          userEmail: owner?.email,
          notifyEmail: !!owner?.notify_email,
          smsPhone: typeof owner?.sms_phone === 'string' ? owner.sms_phone : ''
        });
        results.push({ id: buddy.id, name: buddy.name, ok: true, count: lines.length });
      } catch (e) {
        results.push({ id: buddy.id, name: buddy.name, ok: false, error: String(e.message || e) });
      }
    }

    return Response.json({
      due: due.length,
      ran: results.filter((r) => r.ok).length,
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
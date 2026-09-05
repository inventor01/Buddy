import { parseScheduleFromWhen, parseDelivery } from '../../shared/plan.ts';

// Recompiles a plan after someone rewords a card. No AI, no saving —
// just the rules: WHEN → the daily schedule it will run on, TELLS →
// the channel that delivers the answer.
export default async function(req) {
  try {
    let body = {};
    try { body = await req.json(); } catch (e) { body = {}; }

    const when = typeof body?.when_line === 'string' ? body.when_line.slice(0, 200) : '';
    const how = typeof body?.how_line === 'string' ? body.how_line.slice(0, 200) : '';

    return Response.json({
      schedule_time: parseScheduleFromWhen(when),
      delivery: parseDelivery(how)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
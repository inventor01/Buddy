import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { checkUsageLimit } from '../../shared/rateLimit.ts';

const CREATURES = ['sam', 'sid', 'bells', 'med'];
const RUN_MODES = ['once', 'watch', 'repeat'];
const KINDS = ['web', 'ads', 'social'];
const CAPABILITIES = ['web', 'gmail', 'calendar', 'tasks'];
const ACTIONS = ['none', 'email_read', 'email_send', 'calendar_read', 'calendar_create', 'task_create'];
const APPROVALS = ['not_needed', 'pending', 'approved', 'executing', 'rejected', 'executed', 'failed', 'needs_connection'];

function text(v: unknown, max: number) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function cleanPayload(raw: any) {
  const clean = (v: unknown, max: number) => {
    const s = text(v, max);
    return /^(n\/?a|none|null|not applicable|unknown)$/i.test(s) ? '' : s;
  };
  return {
    recipient: clean(raw?.recipient, 200),
    subject: clean(raw?.subject, 200),
    body: clean(raw?.body, 1200),
    query: clean(raw?.query, 300),
    title: clean(raw?.title, 200),
    start: clean(raw?.start, 100),
    end: clean(raw?.end, 100),
    due: clean(raw?.due, 100),
    notes: clean(raw?.notes, 600),
  };
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const quota = await checkUsageLimit({ base44, req, scope: 'create-thing', minuteLimit: 10, dayLimit: 60 });
    if (!quota.ok) {
      return Response.json(
        { error: 'Too many new things right now. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(quota.retryAfter || 60) } }
      );
    }

    // Enforce the free limit on the server. UI copy is never the security or
    // billing boundary. Deleted records no longer count; all existing things do.
    if (user.plan !== 'pro' && user.role !== 'admin') {
      const existing = await base44.asServiceRole.entities.Buddy.filter(
        { created_by_id: user.id },
        '-created_date',
        4
      );
      if (Array.isArray(existing) && existing.length >= 3) {
        return Response.json(
          { error: 'You have used your three free things.', upgrade_required: true },
          { status: 403 }
        );
      }
    }

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }

    const note = text(body.note, 300);
    const name = text(body.name, 80);
    if (note.length < 3 || !name) {
      return Response.json({ error: 'This handoff is missing its note or name.' }, { status: 400 });
    }

    const actionType = ACTIONS.includes(body.action_type) ? body.action_type : 'none';
    const writeAction = ['email_send', 'calendar_create', 'task_create'].includes(actionType);
    const deferredAction = body.deferred_action === true;
    let approvalStatus = APPROVALS.includes(body.approval_status) ? body.approval_status : 'not_needed';
    if (writeAction) approvalStatus = deferredAction ? 'not_needed' : 'pending';
    else if (approvalStatus === 'pending' || approvalStatus === 'approved' || approvalStatus === 'executing') approvalStatus = 'not_needed';

    const record: any = {
      // Service-role writes must still be owned by the authenticated app user,
      // otherwise owner-only RLS would make the record inaccessible.
      created_by_id: user.id,
      created_by: user.email || null,
      note,
      name,
      creature: CREATURES.includes(body.creature) ? body.creature : 'sam',
      kind: KINDS.includes(body.kind) ? body.kind : 'web',
      run_mode: RUN_MODES.includes(body.run_mode) ? body.run_mode : 'once',
      capability: CAPABILITIES.includes(body.capability) ? body.capability : 'web',
      action_type: actionType,
      action_payload: cleanPayload(body.action_payload || {}),
      approval_status: approvalStatus,
      deferred_action: deferredAction,
      when_line: text(body.when_line, 120),
      what_line: text(body.what_line, 200),
      how_line: text(body.how_line, 200),
      schedule_time: text(body.schedule_time, 40) || '9:00 AM',
      status: 'active',
    };

    const imageUrl = text(body.image_url, 500);
    if (/^https?:\/\//i.test(imageUrl)) record.image_url = imageUrl;

    if (Array.isArray(body.context)) {
      record.context = body.context
        .filter((x: unknown) => typeof x === 'string' && x.trim())
        .slice(0, 5)
        .map((x: string) => x.trim().slice(0, 300));
    }

    const created = await base44.asServiceRole.entities.Buddy.create(record);
    return Response.json({ buddy: created });
  } catch (error: any) {
    return Response.json({ error: String(error?.message || error || 'Could not create that thing.') }, { status: 500 });
  }
}

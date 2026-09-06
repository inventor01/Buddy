import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

function base64Url(input: string) {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function cleanPayload(raw: any) {
  const s = (v: any, n: number) => typeof v === 'string' ? v.trim().slice(0, n) : '';
  return {
    recipient: s(raw?.recipient, 200),
    subject: s(raw?.subject, 200),
    body: s(raw?.body, 1200),
    query: s(raw?.query, 300),
    title: s(raw?.title, 200),
    start: s(raw?.start, 100),
    end: s(raw?.end, 100),
    due: s(raw?.due, 100),
    notes: s(raw?.notes, 600),
  };
}

async function userConnection(base44: any, capability: string) {
  const envName = capability === 'gmail'
    ? 'GMAIL_APP_USER_CONNECTOR_ID'
    : capability === 'calendar'
      ? 'GOOGLE_CALENDAR_APP_USER_CONNECTOR_ID'
      : capability === 'tasks'
        ? 'GOOGLE_TASKS_APP_USER_CONNECTOR_ID'
        : '';
  if (!envName) throw new Error('This kind of handoff is not connected yet.');
  const connectorId = secrets.get(envName);
  if (!connectorId) throw new Error('This ability is not ready in Buddy yet.');
  try {
    return await base44.asServiceRole.connectors.getCurrentAppUserConnection(connectorId);
  } catch (_) {
    const err: any = new Error('Connect this account first.');
    err.code = 'NEEDS_CONNECTION';
    throw err;
  }
}

export default async function(req: Request) {
  let actionBuddyId = '';
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const buddyId = typeof body?.buddyId === 'string' ? body.buddyId.trim() : '';
    actionBuddyId = buddyId;
    const approve = body?.approve === true;
    if (!buddyId) return Response.json({ error: 'Missing handoff id.' }, { status: 400 });

    const buddy = await base44.entities.Buddy.get(buddyId);
    if (!buddy || buddy.created_by_id !== user.id) {
      return Response.json({ error: 'That handoff is not yours.' }, { status: 403 });
    }

    if (!approve) {
      await base44.entities.Buddy.update(buddy.id, { approval_status: 'rejected', status: 'done' });
      return Response.json({ ok: true, rejected: true });
    }

    if (buddy.approval_status !== 'pending' && buddy.approval_status !== 'needs_connection') {
      return Response.json({ error: 'This handoff is not waiting for approval.' }, { status: 409 });
    }

    // Move into an explicit in-flight state before touching an outside service.
    // This blocks ordinary retries/double-clicks from reusing an approval.
    await base44.entities.Buddy.update(buddy.id, { approval_status: 'executing' });
    const locked = await base44.entities.Buddy.get(buddy.id);
    if (!locked || locked.approval_status !== 'executing') {
      return Response.json({ error: 'This handoff is already being handled.' }, { status: 409 });
    }

    const action = buddy.action_type || 'none';
    const payload = cleanPayload(buddy.action_payload || {});
    const { accessToken } = await userConnection(base44, buddy.capability || 'web');

    let summary = '';

    if (action === 'email_send') {
      if (!payload.recipient || !payload.subject || !payload.body) {
        return Response.json({ error: 'The email is missing a recipient, subject, or message.' }, { status: 400 });
      }
      const mime = [
        `To: ${payload.recipient}`,
        `Subject: ${payload.subject}`,
        'Content-Type: text/plain; charset="UTF-8"',
        '',
        payload.body,
      ].join('\r\n');
      const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: base64Url(mime) }),
      });
      if (!r.ok) throw new Error(`Gmail rejected the send (${r.status}).`);
      summary = `Sent the email to ${payload.recipient}.`;
    } else if (action === 'calendar_create') {
      if (!payload.title || !payload.start) {
        return Response.json({ error: 'The calendar item is missing a title or start time.' }, { status: 400 });
      }
      const end = payload.end || payload.start;
      const event: any = {
        summary: payload.title,
        description: payload.notes || undefined,
      };
      const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(payload.start);
      if (dateOnly) {
        event.start = { date: payload.start };
        event.end = { date: end };
      } else {
        event.start = { dateTime: payload.start };
        event.end = { dateTime: end };
      }
      const r = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
      if (!r.ok) throw new Error(`Calendar rejected the event (${r.status}).`);
      summary = `Added “${payload.title}” to your calendar.`;
    } else if (action === 'task_create') {
      if (!payload.title) return Response.json({ error: 'The task needs a title.' }, { status: 400 });
      const task: any = { title: payload.title, notes: payload.notes || undefined };
      if (payload.due) {
        const d = new Date(payload.due);
        if (!Number.isNaN(d.getTime())) task.due = d.toISOString();
      }
      const r = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      });
      if (!r.ok) throw new Error(`Google Tasks rejected the task (${r.status}).`);
      summary = `Added “${payload.title}” to your tasks.`;
    } else {
      return Response.json({ error: 'This handoff does not have a supported action yet.' }, { status: 400 });
    }

    const msg = { who: 'note', at: new Date().toISOString(), text: summary };
    const messages = [...(Array.isArray(buddy.messages) ? buddy.messages : []), msg];
    await base44.entities.Buddy.update(buddy.id, {
      approval_status: 'executed',
      status: buddy.run_mode === 'once' ? 'done' : buddy.status,
      messages,
      last_result: [summary],
    });

    return Response.json({ ok: true, summary });
  } catch (error: any) {
    const message = String(error?.message || error || 'That handoff could not finish.');
    if (error?.code === 'NEEDS_CONNECTION') {
      try {
        const base44 = createClientFromRequest(req);
        if (actionBuddyId) await base44.entities.Buddy.update(actionBuddyId, { approval_status: 'needs_connection' });
      } catch (_) {}
      return Response.json({ error: message, needs_connection: true }, { status: 409 });
    }
    try {
      const base44 = createClientFromRequest(req);
      if (actionBuddyId) await base44.entities.Buddy.update(actionBuddyId, { approval_status: 'failed' });
    } catch (_) {}
    return Response.json({ error: message }, { status: 500 });
  }
}
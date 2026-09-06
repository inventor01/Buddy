import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { createReceiptOnce } from '../../shared/receipts.ts';
import { recordEscalationOnce, resolveEscalation } from '../../shared/escalation.ts';

function base64Url(input: string) {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function cleanPayload(raw: any) {
  const s = (v: any, n: number) => {
    const text = typeof v === 'string' ? v.trim().slice(0, n) : '';
    return /^(n\/?a|none|null|not applicable|unknown)$/i.test(text) ? '' : text;
  };
  return {
    recipient: s(raw?.recipient, 200),
    subject: s(raw?.subject, 200),
    body: s(raw?.body, 6000),
    query: s(raw?.query, 2000),
    title: s(raw?.title, 200),
    start: s(raw?.start, 100),
    end: s(raw?.end, 100),
    due: s(raw?.due, 100),
    notes: s(raw?.notes, 2000),
    thread_id: s(raw?.thread_id, 300),
  };
}

async function normalizeCalendarRange(base44: any, payload: any, timeZone: string) {
  const resolved = await base44.asServiceRole.integrations.Core.InvokeLLM({
    model: 'gemini_3_flash',
    prompt: [
      `Current UTC time: ${new Date().toISOString()}`,
      `User timezone: ${timeZone || 'UTC'}`,
      `Start as written: ${payload.start}`,
      `End as written: ${payload.end || '(not provided)'}`,
      'Convert the event range to exact ISO/RFC3339 values without changing the user’s intended day or start time.',
      'If no end/duration was provided, use exactly one hour after the start.',
      'For an all-day date, return YYYY-MM-DD start and the next YYYY-MM-DD as end.',
      'Do not invent a different date or time.'
    ].join('\n'),
    response_json_schema: {
      type: 'object',
      properties: {
        start: { type: 'string' },
        end: { type: 'string' },
        all_day: { type: 'boolean' }
      },
      required: ['start', 'end', 'all_day']
    }
  });
  return {
    start: String(resolved?.start || '').trim(),
    end: String(resolved?.end || '').trim(),
    allDay: resolved?.all_day === true,
  };
}

async function normalizeTaskDue(base44: any, due: string, timeZone: string) {
  if (!due) return '';
  const resolved = await base44.asServiceRole.integrations.Core.InvokeLLM({
    model: 'gemini_3_flash',
    prompt: [
      `Current UTC time: ${new Date().toISOString()}`,
      `User timezone: ${timeZone || 'UTC'}`,
      `Due date as written: ${due}`,
      'Convert this to the next intended due date/time in ISO 8601. Preserve the user’s intended day. If only a date is given, use 9:00 AM local time.'
    ].join('\n'),
    response_json_schema: {
      type: 'object',
      properties: { due: { type: 'string' } },
      required: ['due']
    }
  });
  return String(resolved?.due || '').trim();
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
  let actionBuddy: any = null;
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
    actionBuddy = buddy;
    if (!buddy || buddy.owner_id !== user.id) {
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
    let continuationPatch: any = null;

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
      const existingThreadId = payload.thread_id || String(buddy.chain_state?.gmail_thread_id || '');
      const sendBody: any = { raw: base64Url(mime) };
      if (existingThreadId) sendBody.threadId = existingThreadId;
      const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(sendBody),
      });
      if (!r.ok) throw new Error(`Gmail rejected the send (${r.status}).`);
      const sent = await r.json();
      const handlesResponses = buddy.execution_mode === 'chain' && Array.isArray(buddy.task_steps) && buddy.task_steps.some((step: any) => step?.type === 'handle_responses');
      if (handlesResponses && sent?.threadId) {
        let messageCount = Number(buddy.chain_state?.gmail_message_count) || 1;
        try {
          const threadRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(sent.threadId)}?format=metadata`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (threadRes.ok) {
            const thread = await threadRes.json();
            if (Array.isArray(thread?.messages)) messageCount = thread.messages.length;
          }
        } catch (_) {}
        continuationPatch = {
          action_type: 'email_read',
          action_payload: { query: payload.subject || payload.recipient, thread_id: sent.threadId },
          approval_status: 'not_needed',
          deferred_action: false,
          status: 'active',
          chain_state: {
            phase: 'waiting_response',
            gmail_thread_id: sent.threadId,
            gmail_message_count: messageCount,
            last_checked_at: '',
          },
        };
        summary = `Sent the email to ${payload.recipient}. Buddy is ready to check this thread for replies.`;
      } else {
        summary = `Sent the email to ${payload.recipient}.`;
      }
    } else if (action === 'calendar_create') {
      if (!payload.title || !payload.start) {
        return Response.json({ error: 'The calendar item is missing a title or start time.' }, { status: 400 });
      }
      const normalized = await normalizeCalendarRange(base44, payload, typeof user.timezone === 'string' ? user.timezone : 'UTC');
      if (!normalized.start || !normalized.end) {
        return Response.json({ error: 'I could not safely understand that calendar time.' }, { status: 400 });
      }
      const event: any = {
        summary: payload.title,
        description: payload.notes || undefined,
      };
      if (normalized.allDay) {
        event.start = { date: normalized.start };
        event.end = { date: normalized.end };
      } else {
        event.start = { dateTime: normalized.start, timeZone: typeof user.timezone === 'string' ? user.timezone : undefined };
        event.end = { dateTime: normalized.end, timeZone: typeof user.timezone === 'string' ? user.timezone : undefined };
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
        const due = await normalizeTaskDue(base44, payload.due, typeof user.timezone === 'string' ? user.timezone : 'UTC');
        const d = new Date(due);
        if (due && !Number.isNaN(d.getTime())) task.due = d.toISOString();
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
    const finalPatch: any = continuationPatch || {
      approval_status: 'executed',
      status: buddy.run_mode === 'once' ? 'done' : buddy.status,
    };
    await base44.entities.Buddy.update(buddy.id, {
      ...finalPatch,
      messages,
      last_result: [summary],
    });

    const change = action === 'email_send'
      ? `Email sent to ${payload.recipient}`
      : action === 'calendar_create'
        ? `Calendar event added: ${payload.title}`
        : action === 'task_create'
          ? `Task added: ${payload.title}`
          : summary;
    const receipt = await createReceiptOnce({
      base44,
      buddy,
      summary,
      items: [],
      personalFacts: [],
      changesMade: [change],
      confirmation: summary,
      outcome: 'approved and completed',
      estimatedTimeSavedMinutes: 8,
    });
    await resolveEscalation(base44, buddy.id, user.id);

    return Response.json({ ok: true, summary, buddy_patch: finalPatch, receipt: receipt ? { id: receipt.id, completed_at: receipt.completed_at } : null });
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
      if (actionBuddy?.owner_id) await recordEscalationOnce({ base44, buddy: actionBuddy, reason: message, nextStep: 'Reconnect the service or retry the approved action. The request and approval details are preserved.' });
    } catch (_) {}
    return Response.json({ error: message, preserved: !!actionBuddyId }, { status: 500 });
  }
}
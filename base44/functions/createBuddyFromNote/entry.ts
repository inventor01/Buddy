import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { checkUsageLimit } from '../../shared/rateLimit.ts';

// Turns one plain sentence into a plain-language plan. The consumer never
// needs to know about agents, workflows, or automation — they only see what
// will happen, when it will happen, and how they'll hear about it.
const CREATURES = ["sam", "sid", "bells", "med"];

function looksLikeFlightRequest(value) {
  return /\b(flight|flights|airfare|plane ticket|airline)\b/i.test(String(value || ''));
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const quota = await checkUsageLimit({ base44, req, scope: 'plan', minuteLimit: 12, dayLimit: 80 });
    if (!quota.ok) {
      return Response.json(
        { error: 'Too many requests right now. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(quota.retryAfter || 60) } }
      );
    }

    let body = {};
    try { body = await req.json(); } catch (e) { body = {}; }
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : '';
    const imageUrl = typeof body.image_url === 'string' && /^https?:\/\//i.test(body.image_url.trim())
      ? body.image_url.trim().slice(0, 500)
      : '';
    if (note.length < 3) {
      return Response.json(
        { error: 'Write a little more — one plain sentence is enough to get started.' },
        { status: 400 }
      );
    }

    const plan = await base44.asServiceRole.integrations.Core.InvokeLLM({
      ...(imageUrl ? { file_urls: [imageUrl] } : {}),
      prompt: [
        'A person wrote down something they want handled. Turn it into the simplest useful plan.',
        'Note: "' + note + '"',
        'CRITICAL: preserve every explicit constraint exactly as written — prices, dates, times, locations, names, quantities, thresholds, recipients, and frequency. Never loosen, round, substitute, or invent a constraint.',
        'Do not ask a question for information already present in the note. Only ask when a genuinely required detail is missing.',
        ...(imageUrl
          ? ['A photo is attached — identify the product or thing it shows, and make what_line about finding that exact thing every day.']
          : []),
        'If the note is about running ad campaigns — Facebook, Instagram, TikTok or Google ads, ad spend, budgets, ROAS, CPC, pausing or creating ads — kind = "ads".',
        'If the note is about posting on or running a Facebook Page — scheduled posts, daily tips, promoting the page — kind = "social".',
        'Any other note kind = "web".',
        'Also decide whether this request needs an outside ability:',
        'capability = "gmail" only when the user explicitly refers to email/Gmail/inbox or asks to send/read an email.',
        'capability = "calendar" only when the user explicitly refers to their calendar/schedule or asks to add/check an event.',
        'capability = "tasks" only when the user explicitly says to add/create something in their tasks, to-do list, or Google Tasks.',
        'A reminder, weekly summary, checklist, or "things to remember" request by itself is NOT a tasks integration request; keep capability = "web" unless the user explicitly names a task/to-do system.',
        'Otherwise capability = "web".',
        'Choose action_type:',
        'email_read = search/read email only. email_send = send an email. calendar_read = inspect calendar only. calendar_create = add an event. task_create = add a task. none = no outside action.',
        'Only choose a write action when the user clearly asks to send/add/create/put/schedule something in that outside service. Never infer a write action merely because a reminder or summary could theoretically be stored there.',
        'For any write action (email_send, calendar_create, task_create), approval_required MUST be true. Never silently send, schedule, post, buy, book, delete, pay, or change anything.',
        'Fill action_payload only with details explicitly supported by the request. Never invent recipients, dates, addresses, money amounts, or commitments.',
        'For action_payload.query, copy the user’s important search constraints faithfully. If they say under $300, the query must stay under $300 — never change it.',
        'Pick the best creature:',
        'sam = shopping, errands, deals. sid = stores, products, prices. bells = dates, birthdays, greetings, reminders. med = medications, health check-ins.',
        'Give the thing a short, friendly two-word title a normal person would understand (like "Miami Flights" or "Renewal Watch").',
        'Choose run_mode from these meanings:',
        'once = handle this now and finish. Use this for one-time research, comparisons, summaries, planning, or finding something now.',
        'watch = keep checking until something meaningful changes or a condition is met. Use this for price drops, openings, availability, deadlines, and "tell me when" requests.',
        'repeat = do the same useful thing on an ongoing schedule. Use this for daily, weekly, monthly, or recurring briefs and reminders.',
        'If the user does not ask for ongoing checking or repetition, prefer once.',
        'Write three plain lines a grandparent could understand:',
        'when_line = when it happens. For once, use "Right now". For watch/repeat, use the clearest timing from the request.',
        'what_line = what it does, in one sentence.',
        'how_line = how it gets the result back to the person (for example "Shows the answer here and texts you when it matters").',
        'schedule_time = the time it should check. For once with no time, use the current/default time "9:00 AM" because it will run immediately anyway.',
        'If a detail the job truly needs is missing (which account, whose birthday, which store, a date, or a number to watch), question = ONE short friendly question asking for exactly that, in plain words. For flights, departure city/airport is required; destination alone is not enough. For "near me" local services, ask for city or ZIP unless a location was provided. If it is specific enough already, question = "".'
      ].join('\n'),
      response_json_schema: {
        type: 'object',
        properties: {
          buddy_name: { type: 'string' },
          creature: { type: 'string', enum: CREATURES },
          kind: { type: 'string', enum: ['web', 'ads', 'social'] },
          run_mode: { type: 'string', enum: ['once', 'watch', 'repeat'] },
          capability: { type: 'string', enum: ['web', 'gmail', 'calendar', 'tasks'] },
          action_type: { type: 'string', enum: ['none', 'email_read', 'email_send', 'calendar_read', 'calendar_create', 'task_create'] },
          approval_required: { type: 'boolean' },
          action_payload: {
            type: 'object',
            properties: {
              recipient: { type: 'string' },
              subject: { type: 'string' },
              body: { type: 'string' },
              query: { type: 'string' },
              title: { type: 'string' },
              start: { type: 'string' },
              end: { type: 'string' },
              due: { type: 'string' },
              notes: { type: 'string' }
            }
          },
          when_line: { type: 'string' },
          what_line: { type: 'string' },
          how_line: { type: 'string' },
          schedule_time: { type: 'string' },
          question: { type: 'string' }
        },
        required: ['buddy_name', 'creature', 'run_mode', 'capability', 'action_type', 'approval_required', 'when_line', 'what_line', 'how_line', 'schedule_time']
      }
    });

    const explicitMoney = note.match(/\$\s*\d+(?:\.\d+)?/g) || [];
    let question = typeof plan?.question === 'string' ? plan.question.trim().slice(0, 200) : '';
    if (explicitMoney.length && /price|budget|maximum|max|dollar|cost/i.test(question)) question = '';

    const lowerNote = note.toLowerCase();
    const explicitEmail = /\b(email|gmail|inbox|mail)\b/.test(lowerNote);
    const explicitCalendar = /\b(calendar|schedule)\b/.test(lowerNote);
    const explicitTasks = /\b(tasks?|to-?do|google tasks)\b/.test(lowerNote);
    const wantsWrite = /\b(send|email|add|create|put|schedule)\b/.test(lowerNote);
    const wantsRead = /\b(read|check|search|find|summarize|summary|look through|show me)\b/.test(lowerNote);

    let guardedCapability = 'web';
    let guardedActionType = 'none';
    if (explicitEmail) {
      guardedCapability = 'gmail';
      if (wantsWrite && /\b(send|email)\b/.test(lowerNote)) guardedActionType = 'email_send';
      else if (wantsRead) guardedActionType = 'email_read';
    } else if (explicitCalendar) {
      guardedCapability = 'calendar';
      if (wantsWrite && /\b(add|create|put|schedule)\b/.test(lowerNote)) guardedActionType = 'calendar_create';
      else if (wantsRead) guardedActionType = 'calendar_read';
    } else if (explicitTasks) {
      guardedCapability = 'tasks';
      if (wantsWrite && /\b(add|create|put)\b/.test(lowerNote)) guardedActionType = 'task_create';
    }

    const recurring = /\b(every|daily|weekly|monthly|each (day|week|month|morning|evening)|every (day|week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/.test(lowerNote);
    const watching = /\b(tell me when|let me know when|notify me when|watch for|keep an eye on|when .* (opens?|drops?|changes?|available|in stock))\b/.test(lowerNote);
    const guardedRunMode = recurring ? 'repeat' : watching ? 'watch' : 'once';
    const connectedBackgroundUnsupported = guardedCapability !== 'web' && guardedRunMode !== 'once';
    const effectiveRunMode = connectedBackgroundUnsupported ? 'once' : guardedRunMode;
    const rawPayload = plan?.action_payload && typeof plan.action_payload === 'object' ? plan.action_payload : {};
    const dependencyLanguage = /\b(one i choose|one i pick|the one i choose|the one i pick|after i choose|after i pick|once i choose|once i pick|after you show me|after you find|then (send|add|put|schedule|create))\b/.test(lowerNote);
    const emailNeedsAddress = guardedActionType === 'email_send' && !/@/.test(String(rawPayload.recipient || ''));
    const calendarNeedsStart = guardedActionType === 'calendar_create' && !String(rawPayload.start || '').trim();
    const taskNeedsTitle = guardedActionType === 'task_create' && !String(rawPayload.title || '').trim();
    const deferredAction = ['email_send', 'calendar_create', 'task_create'].includes(guardedActionType) &&
      (dependencyLanguage || emailNeedsAddress || calendarNeedsStart || taskNeedsTitle);
    const cleanField = (value, max) => {
      const text = String(value || '').trim().slice(0, max);
      return /^(n\/?a|none|null|not applicable|unknown)$/i.test(text) ? '' : text;
    };
    const safeQuery = explicitMoney.length ? note.slice(0, 300) : cleanField(rawPayload.query, 300);
    if (connectedBackgroundUnsupported) {
      question = `I can handle this while you're here, but I can't keep checking your ${guardedCapability === 'gmail' ? 'Email' : guardedCapability === 'calendar' ? 'Calendar' : 'Tasks'} in the background yet. Want me to handle it now?`;
    } else if (emailNeedsAddress) {
      question = 'What email address should I use?';
    } else if (calendarNeedsStart) {
      question = 'What date and time should I put this on your calendar?';
    } else if (taskNeedsTitle) {
      question = 'What should I call this task?';
    }

    const safePlan = {
      name: typeof plan?.buddy_name === 'string' && plan.buddy_name.trim()
        ? plan.buddy_name.trim().slice(0, 40)
        : 'Helpful Buddy',
      creature: CREATURES.includes(plan?.creature) ? plan.creature : 'sam',
      kind: ['ads', 'social'].includes(plan?.kind) ? plan.kind : 'web',
      run_mode: effectiveRunMode,
      capability: guardedCapability,
      action_type: guardedActionType,
      approval_required: ['email_send', 'calendar_create', 'task_create'].includes(guardedActionType) && !deferredAction,
      deferred_action: deferredAction,
      action_payload: {
        recipient: cleanField(rawPayload.recipient, 200),
        subject: cleanField(rawPayload.subject, 200),
        body: cleanField(rawPayload.body, 1200),
        query: safeQuery,
        title: cleanField(rawPayload.title, 200),
        start: cleanField(rawPayload.start, 100),
        end: cleanField(rawPayload.end, 100),
        due: cleanField(rawPayload.due, 100),
        notes: cleanField(rawPayload.notes, 600)
      },
      when_line: effectiveRunMode === 'once' ? 'Right now' : String(plan?.when_line || 'Right now').slice(0, 120),
      what_line: looksLikeFlightRequest(note) && effectiveRunMode === 'once'
        ? `Find current flight options that match: ${note}`.slice(0, 200)
        : String(plan?.what_line || 'Runs your note for you').slice(0, 200),
      how_line: String(plan?.how_line || 'Pins the answer back to your garden').slice(0, 200),
      schedule_time: String(plan?.schedule_time || '9:00 AM').slice(0, 40),
      question
    };

    return Response.json({ plan: safePlan });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
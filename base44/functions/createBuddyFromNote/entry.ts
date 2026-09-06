import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Turns one plain sentence into a plain-language plan. The consumer never
// needs to know about agents, workflows, or automation — they only see what
// will happen, when it will happen, and how they'll hear about it.
const CREATURES = ["sam", "sid", "bells", "med"];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

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
        'If a detail the job truly needs is missing (which account, whose birthday, which store, a date, or a number to watch), question = ONE short friendly question asking for exactly that, in plain words. If it is specific enough already, question = "".'
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

    const safePlan = {
      name: typeof plan?.buddy_name === 'string' && plan.buddy_name.trim()
        ? plan.buddy_name.trim().slice(0, 40)
        : 'Helpful Buddy',
      creature: CREATURES.includes(plan?.creature) ? plan.creature : 'sam',
      kind: ['ads', 'social'].includes(plan?.kind) ? plan.kind : 'web',
      run_mode: ['once', 'watch', 'repeat'].includes(plan?.run_mode) ? plan.run_mode : 'once',
      capability: ['gmail', 'calendar', 'tasks'].includes(plan?.capability) ? plan.capability : 'web',
      action_type: ['email_read', 'email_send', 'calendar_read', 'calendar_create', 'task_create'].includes(plan?.action_type) ? plan.action_type : 'none',
      approval_required: plan?.approval_required === true,
      action_payload: plan?.action_payload && typeof plan.action_payload === 'object' ? {
        recipient: String(plan.action_payload.recipient || '').slice(0, 200),
        subject: String(plan.action_payload.subject || '').slice(0, 200),
        body: String(plan.action_payload.body || '').slice(0, 1200),
        query: String(plan.action_payload.query || '').slice(0, 300),
        title: String(plan.action_payload.title || '').slice(0, 200),
        start: String(plan.action_payload.start || '').slice(0, 100),
        end: String(plan.action_payload.end || '').slice(0, 100),
        due: String(plan.action_payload.due || '').slice(0, 100),
        notes: String(plan.action_payload.notes || '').slice(0, 600)
      } : {},
      when_line: String(plan?.when_line || 'Right now').slice(0, 120),
      what_line: String(plan?.what_line || 'Runs your note for you').slice(0, 200),
      how_line: String(plan?.how_line || 'Pins the answer back to your garden').slice(0, 200),
      schedule_time: String(plan?.schedule_time || '9:00 AM').slice(0, 40),
      question: typeof plan?.question === 'string' ? plan.question.trim().slice(0, 200) : ''
    };

    return Response.json({ plan: safePlan });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
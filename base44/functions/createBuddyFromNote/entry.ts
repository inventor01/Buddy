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
        ...(imageUrl
          ? ['A photo is attached — identify the product or thing it shows, and make what_line about finding that exact thing every day.']
          : []),
        'If the note is about running ad campaigns — Facebook, Instagram, TikTok or Google ads, ad spend, budgets, ROAS, CPC, pausing or creating ads — kind = "ads".',
        'If the note is about posting on or running a Facebook Page — scheduled posts, daily tips, promoting the page — kind = "social".',
        'Any other note kind = "web".',
        'Pick the best creature:',
        'sam = shopping, errands, deals. sid = stores, products, prices. bells = dates, birthdays, greetings, reminders. med = medications, health check-ins.',
        'Give the thing a short, friendly two-word title a normal person would understand (like "Miami Flights" or "Renewal Watch").',
        'when_line = when it happens. For once, use something like "Right now". For watch/repeat, use the clearest timing from the request.'
        'when_line = when it happens (e.g. "Every morning at 9").',
        'what_line = what it does, in one sentence.',
        'how_line = how it tells you (e.g. "Pins the answer back and emails you").',
        'schedule_time = the time it runs, like "9:00 AM".',
        'If a detail the daily job truly needs is missing (which account, whose birthday, which store, a number to watch), question = ONE short friendly question asking the user for exactly that, in plain words. If the note is specific enough already, question = "".'
      ].join('\n'),
      response_json_schema: {
        type: 'object',
        properties: {
          buddy_name: { type: 'string' },
          creature: { type: 'string', enum: CREATURES },
          kind: { type: 'string', enum: ['web', 'ads', 'social'] },
          run_mode: { type: 'string', enum: ['once', 'watch', 'repeat'] },
          when_line: { type: 'string' },
          what_line: { type: 'string' },
          how_line: { type: 'string' },
          schedule_time: { type: 'string' },
          question: { type: 'string' }
        },
        required: ['buddy_name', 'creature', 'run_mode', 'when_line', 'what_line', 'how_line', 'schedule_time']
      }
    });

    const safePlan = {
      name: typeof plan?.buddy_name === 'string' && plan.buddy_name.trim()
        ? plan.buddy_name.trim().slice(0, 40)
        : 'Helpful Buddy',
      creature: CREATURES.includes(plan?.creature) ? plan.creature : 'sam',
      kind: ['ads', 'social'].includes(plan?.kind) ? plan.kind : 'web',
      run_mode: ['once', 'watch', 'repeat'].includes(plan?.run_mode) ? plan.run_mode : 'once',
      when_line: String(plan?.when_line || 'Every morning').slice(0, 120),
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
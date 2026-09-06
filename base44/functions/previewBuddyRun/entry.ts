import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { FINDINGS_RULES, FINDINGS_SCHEMA, toFindingItems, toLines, contextLines } from '../../shared/runBuddy.ts';
import { checkUsageLimit } from '../../shared/rateLimit.ts';
import { isWholesalePropertyRequest, runWholesaleDealFinder } from '../../shared/realEstate.ts';

// Runs a visitor's typed note once, with no account and nothing saved —
// the "watch it run" step for people who haven't signed in. Anonymous by
// design: it only reads the note, bounds its size, and returns findings.
const BUDDY_REQUEST_MAX = 8000;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const quota = await checkUsageLimit({ base44, req, scope: 'preview', minuteLimit: 6, dayLimit: 30 });
    if (!quota.ok) {
      return Response.json(
        { error: 'Too many previews right now. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(quota.retryAfter || 60) } }
      );
    }

    let body = {};
    try { body = await req.json(); } catch (e) { body = {}; }
    const rawNote = typeof body.note === 'string' ? body.note.trim() : '';
    if (rawNote.length > BUDDY_REQUEST_MAX) {
      return Response.json(
        { error: `Keep the request under ${BUDDY_REQUEST_MAX.toLocaleString()} characters.` },
        { status: 413 }
      );
    }
    const note = rawNote;
    if (note.length < 3) {
      return Response.json(
        { error: 'Write a little more — even one sentence is enough to get started.' },
        { status: 400 }
      );
    }
    // The WHAT card, if the visitor reworded it — it's the exact job.
    const what = typeof body.what === 'string' ? body.what.trim().slice(0, 1000) : '';
    const imageUrl = typeof body.image_url === 'string' && /^https?:\/\//i.test(body.image_url.trim())
      ? body.image_url.trim().slice(0, 500)
      : '';
    // Answers the visitor typed when the plan asked — a few, bounded.
    const context = Array.isArray(body.context)
      ? body.context.filter((c) => typeof c === 'string' && c.trim()).slice(0, 5)
      : [];

    const lowerNote = note.toLowerCase();
    const looksLikeFlight = /\b(flight|flights|airfare|plane ticket|airline)\b/.test(lowerNote);
    const hasDestination = /\b(to|into)\s+[a-z]/i.test(note);
    const hasOriginInNote = /\b(from|leaving|depart(?:ing)?(?: from)?)\s+[a-z]/i.test(note);
    const hasOriginInContext = context.some((c) => /[a-z]{2,}/i.test(c));
    if (looksLikeFlight && hasDestination && !hasOriginInNote && !hasOriginInContext) {
      const message = 'What city or airport are you flying from?';
      return Response.json({ state: 'needs_detail', message, lines: [message], items: [] });
    }

    const simplePlanningRequest = /\b(plan|checklist|outline|ideas?)\b/i.test(note) && !/\b(email|gmail|calendar|tasks?|to-?do)\b/i.test(note);

    if (isWholesalePropertyRequest(`${note} ${what}`)) {
      let user = null;
      try { user = await base44.auth.me(); } catch (_) {}
      if (!user?.id) {
        return Response.json({
          state: 'needs_connection',
          message: 'Sign in to run live property underwriting. Buddy uses paid property, ARV, and comp data for this request instead of guessing.',
          lines: ['Sign in to run live property underwriting.'],
          items: [],
        });
      }
      const wholesale = await runWholesaleDealFinder({ base44, buddy: { id: 'preview', owner_id: user.id, note, what_line: what, run_mode: 'repeat', kind: 'web', context } });
      const needs = typeof wholesale?.needs_context === 'string' ? wholesale.needs_context.trim() : '';
      if (needs) return Response.json({ state: 'needs_detail', message: needs, lines: [needs], items: [] });
      const wholesaleItems = toFindingItems(wholesale?.findings);
      return Response.json({ state: wholesaleItems.length ? 'answer' : 'empty', lines: toLines(wholesaleItems), items: wholesaleItems, message: wholesaleItems.length ? undefined : 'No deal cleared the wholesale screen today.' });
    }

    const findings = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: "gemini_3_flash",
      add_context_from_internet: true,
      ...(imageUrl ? { file_urls: [imageUrl] } : {}),
      prompt: [
        "You are a helper for one person.",
        `The actual current UTC date is ${new Date().toISOString().slice(0, 10)}. Use this date as authoritative even if your training data suggests an older year.`,
        "For travel searches, never reject a future date merely because your internal knowledge cutoff makes it feel too far away. Search the current web and verify availability instead.",
        'Their exact words: "' + note + '"',
        what ? "Your daily job: " + what : "",
        ...contextLines({ context }),
        ...(imageUrl
          ? [
              "A photo of the exact thing to find is attached. Treat it like a reverse image search:",
              "identify the product in the photo and report today's best prices and where to buy it."
            ]
          : []),
        simplePlanningRequest ? "This is a simple planning request. Do not ask for a date, whose event it is, or when it happens unless the user explicitly made that detail essential. Produce the useful plan now with the constraints already given." : "",
        "Search the web for today and report back the 5 most useful, concrete findings for this job.",
        "Each finding is one short plain sentence (under 120 characters) with specifics — prices, codes, dates, names.",
        ...FINDINGS_RULES
      ].join("\n"),
      response_json_schema: FINDINGS_SCHEMA
    });

    let needsContext = typeof findings?.needs_context === 'string' ? findings.needs_context.trim().slice(0, 200) : '';
    if (simplePlanningRequest && /\b(date|when|whose|who'?s)\b/i.test(needsContext)) needsContext = '';
    if (needsContext) {
      return Response.json({
        state: 'needs_detail',
        message: needsContext,
        lines: [needsContext],
        items: [],
      });
    }

    const items = toFindingItems(findings?.findings);
    const lines = toLines(items);
    if (!items.length) {
      return Response.json({
        state: 'empty',
        message: "Buddy couldn't verify a useful answer yet.",
        lines: [],
        items: [],
      });
    }

    return Response.json({ state: 'answer', lines, items });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
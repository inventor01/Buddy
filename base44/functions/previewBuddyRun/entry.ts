import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { FINDINGS_RULES, FINDINGS_SCHEMA, toFindingItems, toLines, contextLines } from '../../shared/runBuddy.ts';
import { checkUsageLimit } from '../../shared/rateLimit.ts';

// Runs a visitor's typed note once, with no account and nothing saved —
// the "watch it run" step for people who haven't signed in. Anonymous by
// design: it only reads the note, bounds its size, and returns findings.
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
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : '';
    if (note.length < 3) {
      return Response.json(
        { error: 'Write a little more — even one sentence is enough to get started.' },
        { status: 400 }
      );
    }
    // The WHAT card, if the visitor reworded it — it's the exact job.
    const what = typeof body.what === 'string' ? body.what.trim().slice(0, 200) : '';
    const imageUrl = typeof body.image_url === 'string' && /^https?:\/\//i.test(body.image_url.trim())
      ? body.image_url.trim().slice(0, 500)
      : '';
    // Answers the visitor typed when the plan asked — a few, bounded.
    const context = Array.isArray(body.context)
      ? body.context.filter((c) => typeof c === 'string' && c.trim()).slice(0, 5)
      : [];

    const findings = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: "gemini_3_flash",
      add_context_from_internet: true,
      ...(imageUrl ? { file_urls: [imageUrl] } : {}),
      prompt: [
        "You are a helper for one person.",
        'Their exact words: "' + note + '"',
        what ? "Your daily job: " + what : "",
        ...contextLines({ context }),
        ...(imageUrl
          ? [
              "A photo of the exact thing to find is attached. Treat it like a reverse image search:",
              "identify the product in the photo and report today's best prices and where to buy it."
            ]
          : []),
        "Search the web for today and report back the 5 most useful, concrete findings for this job.",
        "Each finding is one short plain sentence (under 120 characters) with specifics — prices, codes, dates, names.",
        ...FINDINGS_RULES
      ].join("\n"),
      response_json_schema: FINDINGS_SCHEMA
    });

    const needsContext = typeof findings?.needs_context === 'string' ? findings.needs_context.trim().slice(0, 200) : '';
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
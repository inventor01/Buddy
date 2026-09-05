import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { FINDINGS_RULES, FINDINGS_SCHEMA, toFindingItems, toLines } from '../../shared/runBuddy.ts';

// Runs a visitor's typed note once, with no account and nothing saved —
// the "watch it run" step for people who haven't signed in. Anonymous by
// design: it only reads the note, bounds its size, and returns findings.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    let body = {};
    try { body = await req.json(); } catch (e) { body = {}; }
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : '';
    if (note.length < 3) {
      return Response.json({ error: 'Write your note first.' }, { status: 400 });
    }
    // The WHAT card, if the visitor reworded it — it's the exact job.
    const what = typeof body.what === 'string' ? body.what.trim().slice(0, 200) : '';

    const findings = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: "gemini_3_flash",
      add_context_from_internet: true,
      prompt: [
        "You are a helper for one person.",
        'Their exact words: "' + note + '"',
        what ? "Your daily job: " + what : "",
        "Search the web for today and report back the 5 most useful, concrete findings for this job.",
        "Each finding is one short plain sentence (under 120 characters) with specifics — prices, codes, dates, names.",
        ...FINDINGS_RULES
      ].join("\n"),
      response_json_schema: FINDINGS_SCHEMA
    });

    const items = toFindingItems(findings?.findings);
    if (items.length === 0) {
      items.push({ text: "Nothing new today — I will look again next time.", url: '', source: '' });
    }
    const lines = toLines(items);

    return Response.json({ lines, items });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
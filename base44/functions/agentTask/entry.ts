import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { FINDINGS_RULES, FINDINGS_SCHEMA, toFindingItems, toLines } from '../../shared/runBuddy.ts';

// General-purpose agent task runner. Accepts a free-form instruction and
// optional context, then plans + executes it with web search.
// Used by: the thread composer when no buddyId is given, direct API calls.
//
// Body:
//   task      (required) — plain-language instruction
//   context   (optional) — extra context (prior messages, user prefs, etc.)
//   image_url (optional) — photo to reason about
//
// Returns: { lines, items } — same shape as runBuddyNow so the frontend
// can render findings identically.

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch (_) { body = {}; }

    const task = typeof body.task === 'string' ? body.task.trim().slice(0, 600) : '';
    if (!task) {
      return Response.json({ error: 'task is required — describe what you want done.' }, { status: 400 });
    }

    const context = typeof body.context === 'string' ? body.context.trim().slice(0, 800) : '';
    const imageUrl =
      typeof body.image_url === 'string' && /^https?:\/\//i.test(body.image_url.trim())
        ? body.image_url.trim()
        : '';

    const findings = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: 'gemini_3_flash',
      add_context_from_internet: true,
      ...(imageUrl ? { file_urls: [imageUrl] } : {}),
      prompt: [
        'You are a capable personal agent for one person.',
        context ? `Context about this person or their request:\n${context}` : '',
        `Task: "${task}"`,
        'Complete the task as helpfully as possible.',
        'If the task requires web data, look it up and include real, current results.',
        'Give up to 5 short findings (one plain sentence each, under 120 characters).',
        'If the task is a question, answer it directly in the findings.',
        'If nothing was found or the task cannot be completed, say so plainly.',
        ...FINDINGS_RULES,
      ].filter(Boolean).join('\n'),
      response_json_schema: FINDINGS_SCHEMA,
    });

    const items = toFindingItems(findings?.findings);
    if (items.length === 0) {
      items.push({ text: "I couldn't complete that task right now — try rephrasing.", url: '', source: '' });
    }
    const lines = toLines(items);
    return Response.json({ lines, items });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}

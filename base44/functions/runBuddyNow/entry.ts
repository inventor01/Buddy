import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { runBuddy, FINDINGS_RULES, FINDINGS_SCHEMA, toFindingItems, toLines, contextLines } from '../../shared/runBuddy.ts';

// "Run now" — two modes:
//   1. buddyId only → standard daily run (same as the scheduler).
//   2. buddyId + message → answer the user's specific question in context
//      of the buddy, without overwriting last_result or last_run_date.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch (_) { body = {}; }

    const buddyId = typeof body?.buddyId === 'string' ? body.buddyId.trim() : '';
    if (!buddyId) return Response.json({ error: 'Which buddy should run? (buddyId is required)' }, { status: 400 });

    const buddy = await base44.entities.Buddy.get(buddyId);
    if (!buddy || buddy.created_by_id !== user.id) {
      return Response.json({ error: 'That buddy is not yours' }, { status: 403 });
    }

    // ── Mode 2: user sent a specific message ──────────────────────────────
    const userMessage = typeof body?.message === 'string' ? body.message.trim().slice(0, 500) : '';
    if (userMessage) {
      // Answer the question in the context of the buddy, with web search.
      // Don't update last_result or last_run_date — this is a conversation
      // turn, not a scheduled run.

      // If this reply answers a question it asked, the answer becomes a
      // fact it keeps for every future run — ask once, remember forever.
      if (typeof buddy.open_question === 'string' && buddy.open_question) {
        const facts = Array.isArray(buddy.context)
          ? buddy.context.filter((c) => typeof c === 'string')
          : [];
        const context = [...facts, userMessage.slice(0, 300)];
        await base44.entities.Buddy.update(buddyId, { context, open_question: '' });
        buddy.context = context;
        buddy.open_question = '';
      }

      const imageUrl =
        typeof buddy.image_url === 'string' && /^https?:\/\//i.test(buddy.image_url.trim())
          ? buddy.image_url.trim()
          : '';

      const findings = await base44.asServiceRole.integrations.Core.InvokeLLM({
        model: 'gemini_3_flash',
        add_context_from_internet: true,
        ...(imageUrl ? { file_urls: [imageUrl] } : {}),
        prompt: [
          'You are ' + buddy.name + ', a helper for one person.',
          'Their original request: "' + buddy.note + '"',
          'Your daily job: ' + (buddy.what_line || buddy.note),
          ...contextLines(buddy),
          'The user is now asking you a follow-up question: "' + userMessage + '"',
          'Answer the question concretely and helpfully, using today\'s web data where relevant.',
          'Give up to 5 short findings (one sentence each, under 120 characters).',
          ...FINDINGS_RULES,
        ].join('\n'),
        response_json_schema: FINDINGS_SCHEMA,
      });

      const items = toFindingItems(findings?.findings);
      if (items.length === 0) {
        items.push({ text: "I couldn't find an answer right now — try rephrasing.", url: '', source: '' });
      }
      const lines = toLines(items);
      return Response.json({ lines, items });
    }

    // ── Mode 1: standard scheduled run ───────────────────────────────────
    const result = await runBuddy({
      client: base44,
      entityClient: base44,
      buddy,
      userEmail: user.email,
      notifyEmail: !!user.notify_email,
      smsPhone: typeof user.sms_phone === 'string' ? user.sms_phone : '',
      timeZone: typeof user.timezone === 'string' ? user.timezone : '',
    });

    return Response.json({ lines: result.lines, items: result.items });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
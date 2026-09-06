import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { runBuddy, FINDINGS_RULES, FINDINGS_SCHEMA, toFindingItems, toLines, contextLines } from '../../shared/runBuddy.ts';
import { runAdsBuddy } from '../../shared/ads.ts';
import { runSocialBuddy } from '../../shared/social.ts';
import { secrets } from 'base44:runtime';
import { checkUsageLimit } from '../../shared/rateLimit.ts';
import { loadProfile, loadHousehold, householdFacts, profilePromptLines, relevantProfileFacts } from '../../shared/personalization.ts';
import { requestCategory, loadDelegationPolicy, delegationPromptLines } from '../../shared/delegation.ts';
import { createReceiptOnce } from '../../shared/receipts.ts';
import { recordEscalationOnce, resolveEscalation } from '../../shared/escalation.ts';
import { loadVerifiedPhone } from '../../shared/phone.ts';

async function currentUserConnection(base44, capability) {
  const envName = capability === 'gmail'
    ? 'GMAIL_APP_USER_CONNECTOR_ID'
    : capability === 'calendar'
      ? 'GOOGLE_CALENDAR_APP_USER_CONNECTOR_ID'
      : '';
  const connectorId = envName ? secrets.get(envName) : '';
  if (!connectorId) return null;
  try {
    return await base44.asServiceRole.connectors.getCurrentAppUserConnection(connectorId);
  } catch (_) {
    return null;
  }
}

async function savePreferenceIfExplicit(base44, userId, profile, message) {
  const text = String(message || '').trim();
  if (!text) return null;
  const rememberSignal = /^(remember( that)?|from now on|for future|going forward)\b/i.test(text) || /\bi (prefer|like|love|hate|avoid|don'?t like)\b/i.test(text);
  const forgetSignal = /^(forget|don'?t remember|stop remembering)\b/i.test(text);
  if (!rememberSignal && !forgetSignal) return null;

  let current = profile;
  if (!current) {
    current = await base44.asServiceRole.entities.BuddyProfile.create({ owner_id: userId });
  }
  const arrays = {
    travel_preferences: Array.isArray(current.travel_preferences) ? current.travel_preferences.filter(Boolean) : [],
    shopping_preferences: Array.isArray(current.shopping_preferences) ? current.shopping_preferences.filter(Boolean) : [],
    general_preferences: Array.isArray(current.general_preferences) ? current.general_preferences.filter(Boolean) : [],
  };
  const target = /\b(flight|airline|airport|seat|nonstop|layover|hotel|travel|spirit|delta|american airlines|united|southwest)\b/i.test(text)
    ? 'travel_preferences'
    : /\b(shop|shopping|store|brand|delivery|pickup|price|cheapest|target|walmart|amazon|costco)\b/i.test(text)
      ? 'shopping_preferences'
      : 'general_preferences';

  const cleaned = text
    .replace(/^(remember( that)?|from now on|for future|going forward|forget|don'?t remember|stop remembering)[:,\s-]*/i, '')
    .trim()
    .slice(0, 180);
  if (!cleaned) return null;

  if (forgetSignal) {
    for (const key of Object.keys(arrays)) {
      arrays[key] = arrays[key].filter((x) => !String(x).toLowerCase().includes(cleaned.toLowerCase()) && !cleaned.toLowerCase().includes(String(x).toLowerCase()));
    }
    await base44.asServiceRole.entities.BuddyProfile.update(current.id, arrays);
    return { text: `Got it. I won’t use that preference anymore.`, profile: { ...current, ...arrays } };
  }

  if (!arrays[target].some((x) => String(x).toLowerCase() === cleaned.toLowerCase())) arrays[target].push(cleaned);
  arrays[target] = arrays[target].slice(-12);
  await base44.asServiceRole.entities.BuddyProfile.update(current.id, arrays);
  return { text: `Got it. I’ll remember that for future requests.`, profile: { ...current, ...arrays } };
}

async function runConnectedRead({ base44, buddy, message = '' }) {
  const connection = await currentUserConnection(base44, buddy.capability);
  if (!connection?.accessToken) {
    return {
      lines: [`Connect ${buddy.capability === 'gmail' ? 'Email' : 'Calendar'} in Settings before Buddy can check that.`],
      items: [],
      needs_connection: true,
    };
  }

  if (buddy.action_type === 'email_read') {
    const q = String(buddy.action_payload?.query || buddy.note || '').slice(0, 300);
    const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=8&q=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${connection.accessToken}` },
    });
    if (!listRes.ok) throw new Error(`Gmail rejected the read (${listRes.status}).`);
    const listed = await listRes.json();
    const messages = Array.isArray(listed?.messages) ? listed.messages.slice(0, 8) : [];
    const rows = [];
    for (const m of messages) {
      const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, {
        headers: { Authorization: `Bearer ${connection.accessToken}` },
      });
      if (!r.ok) continue;
      const data = await r.json();
      const headers = Object.fromEntries((data?.payload?.headers || []).map((h) => [String(h.name || '').toLowerCase(), h.value || '']));
      rows.push({ from: headers.from || '', subject: headers.subject || '', date: headers.date || '', snippet: data?.snippet || '' });
    }
    if (!rows.length) return { lines: ['I did not find matching email.'], items: [] };
    const summary = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: 'gemini_3_flash',
      prompt: [
        `Original request: ${buddy.note}`,
        message ? `Follow-up: ${message}` : '',
        'Summarize only the email data below. Do not invent details. Return up to 5 short findings.',
        JSON.stringify(rows),
      ].filter(Boolean).join('\n'),
      response_json_schema: FINDINGS_SCHEMA,
    });
    const items = toFindingItems(summary?.findings).map((x) => ({ ...x, source: x.source || 'Gmail' }));
    return { lines: toLines(items), items };
  }

  if (buddy.action_type === 'calendar_read') {
    const from = new Date();
    const to = new Date(from.getTime() + 21 * 24 * 60 * 60 * 1000);
    const qs = new URLSearchParams({
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '40',
    });
    const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${qs}`, {
      headers: { Authorization: `Bearer ${connection.accessToken}` },
    });
    if (!r.ok) throw new Error(`Calendar rejected the read (${r.status}).`);
    const data = await r.json();
    const events = (Array.isArray(data?.items) ? data.items : []).map((e) => ({
      title: e.summary || '(untitled)',
      start: e.start?.dateTime || e.start?.date || '',
      end: e.end?.dateTime || e.end?.date || '',
      location: e.location || '',
    }));
    const summary = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: 'gemini_3_flash',
      prompt: [
        `Original request: ${buddy.note}`,
        message ? `Follow-up: ${message}` : '',
        'Use only these calendar events. Answer the requested day/time window exactly and do not invent events.',
        JSON.stringify(events),
      ].filter(Boolean).join('\n'),
      response_json_schema: FINDINGS_SCHEMA,
    });
    const items = toFindingItems(summary?.findings).map((x) => ({ ...x, source: x.source || 'Calendar' }));
    if (!items.length) return { lines: ['Nothing matching that time window is on your calendar.'], items: [] };
    return { lines: toLines(items), items };
  }

  return { lines: ['That connected read is not supported yet.'], items: [] };
}

// "Run now" — two modes:
//   1. buddyId only → standard daily run (same as the scheduler).
//   2. buddyId + message → answer the user's specific question in context
//      of the buddy, without overwriting last_result or last_run_date.
export default async function (req) {
  let failureBase44: any = null;
  let failureBuddy: any = null;
  try {
    const base44 = createClientFromRequest(req);
    failureBase44 = base44;
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const quota = await checkUsageLimit({ base44, req, scope: 'run-now', minuteLimit: 20, dayLimit: 300 });
    if (!quota.ok) {
      return Response.json(
        { error: 'Too many runs right now. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(quota.retryAfter || 60) } }
      );
    }

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch (_) { body = {}; }

    const buddyId = typeof body?.buddyId === 'string' ? body.buddyId.trim() : '';
    if (!buddyId) return Response.json({ error: 'Which buddy should run? (buddyId is required)' }, { status: 400 });

    const buddy = await base44.entities.Buddy.get(buddyId);
    failureBuddy = buddy;
    if (!buddy || buddy.owner_id !== user.id) {
      return Response.json({ error: 'That Buddy is not yours.' }, { status: 403 });
    }

    const profile = await loadProfile(base44, user.id);
    const household = await loadHousehold(base44, user.id);
    const requestText = `${buddy.note || ''} ${buddy.what_line || ''}`;
    const personalFacts = [...relevantProfileFacts(profile, requestText), ...householdFacts(household, requestText)].slice(0, 14);
    const category = requestCategory(requestText, buddy.capability || 'web');
    const delegation = await loadDelegationPolicy(base44, user.id, category);

    // ── Mode 2: user sent a specific message ──────────────────────────────
    const userMessage = typeof body?.message === 'string' ? body.message.trim().slice(0, 500) : ''; 
    if (userMessage) {
      const learned = await savePreferenceIfExplicit(base44, user.id, profile, userMessage);
      if (learned) {
        return Response.json({ lines: [learned.text], items: [], profile_updated: true });
      }

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

      // A multi-step handoff waits until the user chooses/decides, then
      // turns that choice into a concrete action that still requires approval.
      if (buddy.deferred_action === true && ['email_send', 'calendar_create', 'task_create'].includes(buddy.action_type)) {
        const recent = (Array.isArray(buddy.messages) ? buddy.messages : []).slice(-8).map((m) => `${m.who}: ${m.text}`).join('\n');
        const resolved = await base44.asServiceRole.integrations.Core.InvokeLLM({
          model: 'gemini_3_flash',
          prompt: [
            `Original request: ${buddy.note}`,
            `Waiting action: ${buddy.action_type}`,
            `User's new choice/instruction: ${userMessage}`,
            recent ? `Recent conversation:\n${recent}` : '',
            'Resolve the exact action payload from the user’s choice. Never invent a recipient, selected option, date, time, price, or commitment.',
            'If a required detail is still missing, ready=false and ask one short question. Otherwise ready=true.',
          ].filter(Boolean).join('\n'),
          response_json_schema: {
            type: 'object',
            properties: {
              ready: { type: 'boolean' },
              question: { type: 'string' },
              action_payload: {
                type: 'object',
                properties: {
                  recipient: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' },
                  title: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' },
                  due: { type: 'string' }, notes: { type: 'string' }, query: { type: 'string' },
                },
              },
            },
            required: ['ready'],
          },
        });
        if (resolved?.ready !== true) {
          const q = String(resolved?.question || 'What should I use for that last step?').slice(0, 200);
          return Response.json({ lines: [q], items: [] });
        }
        const payload = resolved?.action_payload && typeof resolved.action_payload === 'object' ? resolved.action_payload : {};
        await base44.entities.Buddy.update(buddy.id, {
          action_payload: payload,
          deferred_action: false,
          approval_status: 'pending',
        });
        return Response.json({
          lines: ['I have the next step ready. Review it before I do anything.'],
          items: [],
          approval_pending: true,
          buddy_patch: { action_payload: payload, deferred_action: false, approval_status: 'pending' },
        });
      }

      if (buddy.action_type === 'email_read' || buddy.action_type === 'calendar_read') {
        const read = await runConnectedRead({ base44, buddy, message: userMessage });
        return Response.json(read);
      }

      // Ad notes answer from the person's live ad account, not the web —
      // the token they pasted in Settings, same thread shape back.
      if (buddy.kind === 'ads') {
        const ads = await runAdsBuddy({
          client: base44,
          buddy,
          facts: contextLines(buddy),
          token: typeof user.meta_token === 'string' ? user.meta_token : '',
          account: typeof user.meta_ad_account === 'string' ? user.meta_ad_account : '',
          message: userMessage
        });
        const items = toFindingItems(ads?.findings);
        if (items.length === 0) {
          items.push({ text: "I couldn't reach your ad account just now — try again.", url: '', source: '' });
        }
        return Response.json({ lines: toLines(items), items });
      }

      // Page notes answer and post from the person's Facebook Page, not
      // the web — the same token from Settings, same thread shape back.
      if (buddy.kind === 'social') {
        const social = await runSocialBuddy({
          client: base44,
          buddy,
          facts: contextLines(buddy),
          token: typeof user.meta_token === 'string' ? user.meta_token : '',
          pageId: typeof user.meta_page_id === 'string' ? user.meta_page_id : '',
          message: userMessage,
          timeZone: typeof user.timezone === 'string' ? user.timezone : ''
        });
        const socialItems = toFindingItems(social?.findings);
        if (socialItems.length === 0) {
          socialItems.push({ text: "I couldn't reach your Facebook Page just now — try again.", url: '', source: '' });
        }
        return Response.json({ lines: toLines(socialItems), items: socialItems });
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
          ...profilePromptLines(profile, `${buddy.note || ''} ${userMessage}`),
          ...(householdFacts(household, `${buddy.note || ''} ${userMessage}`).length ? [
            'Relevant household details this person chose to save:',
            ...householdFacts(household, `${buddy.note || ''} ${userMessage}`).map((f) => `- ${f}`)
          ] : []),
          ...delegationPromptLines(delegation),
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

    // ── Mode 1: standard run ─────────────────────────────────────────────
    // Deferred writes first perform their research/planning step; they do not
    // touch the outside service until a later user choice resolves them.
    if (!buddy.deferred_action && (buddy.action_type === 'email_read' || buddy.action_type === 'calendar_read')) {
      const read = await runConnectedRead({ base44, buddy });
      return Response.json(read);
    }

    const verifiedPhone = await loadVerifiedPhone(base44, user.id);
    const result = await runBuddy({
      client: base44,
      entityClient: base44,
      buddy,
      userEmail: user.email,
      notifyEmail: !!user.notify_email,
      smsPhone: verifiedPhone,
      timeZone: typeof user.timezone === 'string' ? user.timezone : '',
      metaToken: typeof user.meta_token === 'string' ? user.meta_token : '',
      metaAccount: typeof user.meta_ad_account === 'string' ? user.meta_ad_account : '',
      metaPage: typeof user.meta_page_id === 'string' ? user.meta_page_id : '',
      personalFacts,
      delegationLines: delegationPromptLines(delegation),
    });

    if (result?.question) {
      return Response.json({
        state: 'needs_detail',
        message: result.lines?.[0] || 'One more detail is needed.',
        lines: result.lines || [],
        items: [],
      });
    }

    let receipt = null;
    if (buddy.run_mode === 'once' && Array.isArray(result?.lines) && result.lines.length) {
      receipt = await createReceiptOnce({
        base44,
        buddy,
        summary: result.lines.join('\n'),
        items: result.items || [],
        personalFacts,
        changesMade: [],
        outcome: 'answered and handled',
        estimatedTimeSavedMinutes: 10,
      });
    }

    await resolveEscalation(base44, buddy.id, user.id);
    return Response.json({ state: 'answer', lines: result.lines, items: result.items, receipt: receipt ? { id: receipt.id, completed_at: receipt.completed_at } : null, delegation: delegation ? { category, level: delegation.level } : null });
  } catch (error) {
    const message = (error as Error).message || 'Buddy could not finish this automatically.';
    if (failureBase44 && failureBuddy?.owner_id) {
      await recordEscalationOnce({ base44: failureBase44, buddy: failureBuddy, reason: message, nextStep: 'Retry this request. If it still cannot finish, change the request or take over from the saved details.' });
    }
    return Response.json({ error: message, preserved: !!failureBuddy?.id }, { status: 500 });
  }
}
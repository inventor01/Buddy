import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { runBuddy, parseScheduleHour, nowInZone, scheduleMatchesToday } from '../../shared/runBuddy.ts';
import { loadProfile, loadHousehold, householdFacts, relevantProfileFacts } from '../../shared/personalization.ts';
import { requestCategory, loadDelegationPolicy, delegationPromptLines } from '../../shared/delegation.ts';

// Hourly sweep: runs every active buddy whose schedule time has arrived and
// that hasn't already run today. Triggered by the platform's scheduler.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // Scheduled automations arrive without a user token. A signed-in user
    // invoking this directly would run other people's buddies — refuse.
    let user = null;
    try { user = await base44.auth.me(); } catch (e) { user = null; }
    if (user) return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Scan active work in pages instead of only the newest 100. We stop once
    // enough due work is collected or after a bounded scan so one sweep stays
    // predictable under load. Missed-at-the-exact-hour items can catch up
    // later the same local day instead of silently disappearing.
    const PAGE_SIZE = 250;
    const MAX_SCAN = 5000;
    const MAX_DUE = 50;
    const buddies = [];
    for (let skip = 0; skip < MAX_SCAN; skip += PAGE_SIZE) {
      const page = await base44.asServiceRole.entities.Buddy.filter(
        { status: 'active' },
        '-created_date',
        PAGE_SIZE,
        skip
      );
      if (!Array.isArray(page) || page.length === 0) break;
      buddies.push(...page);
      if (page.length < PAGE_SIZE) break;
    }

    // "9 in the morning" means the owner's morning, and "already ran today"
    // their today — so the hour and the date are read on their clock. One
    // lookup per owner, reused across all of that person's notes.
    const owners = new Map();
    const ownerOf = async (userId) => {
      if (owners.has(userId)) return owners.get(userId);
      let owner = null;
      try {
        owner = await base44.asServiceRole.entities.User.get(userId);
      } catch (e) {
        owner = null;
      }
      owners.set(userId, owner);
      return owner;
    };

    const due = [];
    for (const buddy of buddies) {
      if (due.length >= MAX_DUE) break;
      const owner = await ownerOf(buddy.owner_id);
      const local = nowInZone(owner?.timezone);
      const scheduledHour = parseScheduleHour(buddy.schedule_time);
      const reachedTimeToday = local.hour >= scheduledHour;
      const rightDay = buddy.run_mode !== 'repeat' || scheduleMatchesToday(buddy.when_line, owner?.timezone);
      if (reachedTimeToday && rightDay && buddy.last_run_date !== local.date) {
        due.push({ buddy, owner });
      }
    }

    const results = [];
    const runOne = async ({ buddy, owner }) => {
      try {
        const profile = await loadProfile(base44, buddy.owner_id);
        const household = await loadHousehold(base44, buddy.owner_id);
        const requestText = `${buddy.note || ''} ${buddy.what_line || ''}`;
        const personalFacts = [...relevantProfileFacts(profile, requestText), ...householdFacts(household, requestText)].slice(0, 14);
        const category = requestCategory(requestText, buddy.capability || 'web');
        const delegation = await loadDelegationPolicy(base44, buddy.owner_id, category);
        const result = await runBuddy({
          client: base44,
          entityClient: base44.asServiceRole,
          buddy,
          userEmail: owner?.email,
          notifyEmail: !!owner?.notify_email,
          smsPhone: typeof owner?.sms_phone === 'string' ? owner.sms_phone : '',
          timeZone: typeof owner?.timezone === 'string' ? owner.timezone : '',
          metaToken: typeof owner?.meta_token === 'string' ? owner.meta_token : '',
          metaAccount: typeof owner?.meta_ad_account === 'string' ? owner.meta_ad_account : '',
          metaPage: typeof owner?.meta_page_id === 'string' ? owner.meta_page_id : '',
          personalFacts,
          delegationLines: delegationPromptLines(delegation)
        });
        return { id: buddy.id, name: buddy.name, ok: true, count: result.lines.length };
      } catch (e) {
        return { id: buddy.id, name: buddy.name, ok: false, error: String(e.message || e) };
      }
    };

    // Small concurrency keeps the sweep fast without stampeding external APIs.
    for (let i = 0; i < due.length; i += 5) {
      const batch = await Promise.all(due.slice(i, i + 5).map(runOne));
      results.push(...batch);
    }

    return Response.json({
      scanned: buddies.length,
      due: due.length,
      ran: results.filter((r) => r.ok).length,
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
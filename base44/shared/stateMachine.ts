// The single authoritative state machine for Buddy handoffs. Pure by
// construction — no SDK, no secrets, no I/O — so the deterministic mechanics
// gate executes the exact same decision logic the servers use.

// A run lock is considered held while fresh. A worker that crashed mid-run
// leaves a stale lock that self-heals once the TTL passes, so a handoff is
// never permanently stranded (safe stale-job recovery, bounded by the TTL).
export const RUN_LOCK_TTL_MS = 10 * 60 * 1000;

export const APPROVAL_STATES = ['not_needed', 'pending', 'approved', 'executing', 'rejected', 'executed', 'failed', 'needs_connection'];
export const BUDDY_STATUSES = ['active', 'paused', 'done'];
export const JOB_STATUSES = ['planned', 'running', 'needs_user', 'needs_approval', 'completed', 'failed'];

export function isRunLockFresh(runLockAt: unknown, nowMs: number = Date.now(), ttlMs: number = RUN_LOCK_TTL_MS) {
  const at = Date.parse(String(runLockAt || ''));
  if (Number.isNaN(at)) return false;
  const age = nowMs - at;
  // Small negative-age tolerance for clock skew; a lock can never outlive the TTL.
  return age >= -60000 && age < ttlMs;
}

// The scheduler's due decision: one place decides whether this handoff may
// run on this sweep. User-presence states, pauses, fresh locks, "already ran
// today", the scheduled hour, and the repeat weekday all block here — so a
// schedule can never silently run twice in one local day.
export function schedulerRunVerdict({ buddy, localDate, localHour, scheduledHour, rightDay, nowMs = Date.now() }: any) {
  if (!buddy || !buddy.id) return { ok: false, reason: 'missing' };
  if (String(buddy.status || 'active') !== 'active') return { ok: false, reason: 'inactive' };
  const approval = String(buddy.approval_status || 'not_needed');
  if (['pending', 'needs_connection', 'executing'].includes(approval)) return { ok: false, reason: 'awaiting_user' };
  if (buddy.open_question) return { ok: false, reason: 'open_question' };
  if (buddy.action_type === 'email_read' && buddy?.chain_state?.phase === 'waiting_response') {
    return { ok: false, reason: 'waiting_response' };
  }
  if (isRunLockFresh(buddy.run_lock_at, nowMs)) return { ok: false, reason: 'already_running' };
  if (String(buddy.last_run_date || '') === String(localDate || '')) return { ok: false, reason: 'already_ran_today' };
  if (Number(localHour) < Number(scheduledHour)) return { ok: false, reason: 'not_due_yet' };
  if (rightDay !== true) return { ok: false, reason: 'not_scheduled_today' };
  return { ok: true, reason: 'due' };
}

// Approvals: the owner may decide a request that is still pending (or blocked
// on a connection). Everything else is refused with a structured reason —
// replayed approvals after execution, late rejects that would rewrite an
// executed result back to rejected, and other people's handoffs.
export function approvalVerdict(buddy: any, userId: unknown, approve: boolean) {
  if (!buddy) return { ok: false, code: 'not_found', status: 404 };
  if (String(buddy.owner_id || '') !== String(userId || '')) return { ok: false, code: 'not_yours', status: 403 };
  const status = String(buddy.approval_status || 'not_needed');
  if (!['pending', 'needs_connection'].includes(status)) {
    return { ok: false, code: 'not_waiting', status: 409 };
  }
  return { ok: true, code: approve ? 'approved' : 'rejected' };
}

// Notifications: a watch/repeat run with nothing meaningful never interrupts
// the person (should_notify=false is honored), and an arbitrage run with no
// VERIFIED opportunity never notifies — one-sided leads are research, not
// results, whatever the model claimed.
export function notifyVerdict({ shouldNotify, items, isArbitrageScan }: any) {
  let notify = shouldNotify !== false;
  const list = Array.isArray(items) ? items : [];
  if (isArbitrageScan) {
    const verifiedCount = list.filter((item: any) => item?.arbitrage).length;
    notify = notify && verifiedCount > 0;
  }
  return notify;
}

// A once-handoff finishes on success; watch/repeat keep the status they had.
export function statusAfterRun(runMode: unknown, currentStatus: unknown) {
  return String(runMode || '') === 'once' ? 'done' : String(currentStatus || 'active');
}

// The job's honest status from its steps. A failed step blocks every step
// that depends on it, so a job with a failure can never be reported completed.
export function nextJobStatus(steps: unknown) {
  const list = Array.isArray(steps) ? steps : [];
  const has = (name: string) => list.some((step: any) => String(step?.status || '') === name);
  if (has('waiting_response')) return 'needs_user';
  if (has('waiting_approval')) return 'needs_approval';
  if (has('failed')) return 'failed';
  if (has('running') || has('pending')) return 'running';
  return 'completed';
}

// Wix delivers ORDER_APPROVED repeatedly, and may deliver a stale approval
// after a cancellation. A purchase in a terminal state must never be granted
// or revoked again. (payments-webhook implements this same rule at its
// idempotency guard; this predicate is the shared, gate-tested statement.)
export function purchaseEventVerdict(status: unknown) {
  const s = String(status || '');
  if (s === 'paid' || s === 'canceled') return { process: false, reason: 'already_terminal' };
  return { process: true, reason: s || 'pending' };
}

// Free tier: three saved handoffs per person; pro subscribers and admins are
// unlimited. The UI copy is never the billing boundary — this is.
export function freeHandoffVerdict({ plan, role, existingCount }: any) {
  if (String(plan || '') === 'pro' || String(role || '') === 'admin') return { ok: true };
  return Number(existingCount) >= 3 ? { ok: false, upgrade_required: true } : { ok: true };
}

// Duplicate create suppression: a replayed client token returns the original
// record instead of creating a second handoff for the same intent.
export function duplicateCreateVerdict(existing: unknown) {
  if (Array.isArray(existing) && existing.length > 0) {
    return { duplicate: true, buddy: existing[0] };
  }
  return { duplicate: false, buddy: null };
}
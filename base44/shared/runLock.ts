// Server-owned run lock: at most one worker executes a given handoff at a
// time. Shared by the hourly scheduler and the manual "Run now" path so a
// schedule can never overlap a manual run (double spend, double notify,
// out-of-order writes).
import { isRunLockFresh } from './stateMachine.ts';

function newToken(nowMs: number) {
  return Math.random().toString(36).slice(2, 10) + nowMs.toString(36);
}

// Claim = fresh-lock check + unique-token read-back. Under last-write-wins
// storage, exactly one concurrent claimer reads back its own token; every
// loser aborts — so two simultaneous claims can never both proceed.
export async function claimRunLock(entityClient: any, buddyId: string, nowMs: number = Date.now()) {
  if (!buddyId) return { ok: false, reason: 'missing', token: '' };
  const current = await entityClient.entities.Buddy.get(buddyId);
  if (!current) return { ok: false, reason: 'missing', token: '' };
  if (isRunLockFresh(current.run_lock_at, nowMs)) return { ok: false, reason: 'already_running', token: '' };
  const token = newToken(nowMs);
  await entityClient.entities.Buddy.update(buddyId, { run_lock_at: new Date(nowMs).toISOString(), run_token: token });
  const check = await entityClient.entities.Buddy.get(buddyId);
  if (!check || String(check.run_token || '') !== token || !isRunLockFresh(check.run_lock_at, nowMs)) {
    return { ok: false, reason: 'lost_race', token: '' };
  }
  return { ok: true, reason: 'claimed', token };
}

// Release only if this worker still owns the lock, so a slow finisher never
// clears a successor's claim after the TTL handed the lock over.
export async function releaseRunLock(entityClient: any, buddyId: string, token: string) {
  if (!buddyId || !token) return;
  try {
    const current = await entityClient.entities.Buddy.get(buddyId);
    if (current && String(current.run_token || '') === token) {
      await entityClient.entities.Buddy.update(buddyId, { run_lock_at: '', run_token: '' });
    }
  } catch (_) {
    // A release failure must never fail the run that already finished.
  }
}
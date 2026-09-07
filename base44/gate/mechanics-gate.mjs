#!/usr/bin/env node
// Deterministic mechanics gate for Buddy.
//
// Loads the REAL server decision code (base44/shared/*.ts) — no stubs, no
// mirrors — transpiles it in-process, and executes every release-gate
// scenario with an in-memory entity store that has the same get/update
// semantics as the real one. No network, no live charges, no real emails,
// no calendar writes, no destructive production data.
//
// Run: node base44/gate/mechanics-gate.mjs   → exit 0 = all scenarios pass.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const here = path.dirname(fileURLToPath(import.meta.url));
const sharedDir = path.resolve(here, '../shared');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buddy-gate-'));
const compiled = new Map();

// Transpile the pure-TS closure (relative imports only) to CommonJS.
function compile(absTsPath) {
  if (compiled.has(absTsPath)) return compiled.get(absTsPath);
  const source = fs.readFileSync(absTsPath, 'utf8');
  const depSpecs = [...source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)].map((m) => m[1]);
  for (const spec of depSpecs) {
    compile(path.resolve(path.dirname(absTsPath), spec));
  }
  let js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  js = js.replace(/require\((['"])(\.[^'"]+)\1\)/g, (_match, _quote, spec) => {
    const abs = path.resolve(path.dirname(absTsPath), spec);
    return `require(${JSON.stringify(compile(abs))})`;
  });
  const outPath = path.join(tmpDir, `${compiled.size}-${path.basename(absTsPath).replace(/\.ts$/, '')}.js`);
  fs.writeFileSync(outPath, js);
  compiled.set(absTsPath, outPath);
  return outPath;
}

function load(relName) {
  return require(compile(path.join(sharedDir, relName)));
}

const stateMachine = load('stateMachine.ts');
const runLock = load('runLock.ts');
const clarification = load('clarification.ts');
const arbitrage = load('arbitrage.ts');
const rateLimit = load('rateLimit.ts');

// In-memory entity client with the same get/update semantics as the real
// store: get returns a copy, update is a plain merge (last write wins).
function makeEntityClient(initialRows) {
  const store = new Map();
  for (const [id, row] of Object.entries(initialRows)) store.set(id, { ...row });
  return {
    entities: {
      Buddy: {
        async get(id) {
          const row = store.get(id);
          return row ? { ...row } : null;
        },
        async update(id, patch) {
          const row = store.get(id);
          if (!row) throw new Error('record not found');
          Object.assign(row, patch);
          return { ...row };
        },
      },
    },
  };
}

function sanitizeUrlLike(value) {
  let url = String(value || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return '';
    return parsed.toString().slice(0, 800);
  } catch (_) {
    return '';
  }
}

let failedCount = 0;
const results = [];

async function scenario(name, fn) {
  try {
    await fn();
    results.push([name, 'PASS', '']);
  } catch (error) {
    failedCount += 1;
    results.push([name, 'FAIL', String((error && error.message) || error)]);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'assertEqual'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const scenarios = [];
const add = (name, fn) => scenarios.push([name, fn]);

// 1. Successful once handoff completes and never runs again.
add('once handoff completes', async () => {
  const buddy = {
    id: 'once-1', owner_id: 'u1', status: 'active', run_mode: 'once',
    approval_status: 'not_needed', last_run_date: '', run_lock_at: '', run_token: '',
  };
  const client = makeEntityClient({ 'once-1': buddy });
  const claim = await runLock.claimRunLock(client, 'once-1');
  assert(claim.ok, 'a fresh once handoff must be claimable');
  // A successful run pins its result and finishes the handoff.
  await client.entities.Buddy.update('once-1', {
    last_run_date: '2026-09-07',
    status: stateMachine.statusAfterRun(buddy.run_mode, buddy.status),
  });
  await runLock.releaseRunLock(client, 'once-1', claim.token);
  const after = await client.entities.Buddy.get('once-1');
  assertEqual(after.status, 'done', 'once handoff must finish as done');
  const today = stateMachine.schedulerRunVerdict({
    buddy: after, localDate: '2026-09-07', localHour: 10, scheduledHour: 9, rightDay: true,
  });
  assert(!today.ok && today.reason === 'already_ran_today', 'must not run twice in one local day');
  const tomorrow = stateMachine.schedulerRunVerdict({
    buddy: after, localDate: '2026-09-08', localHour: 10, scheduledHour: 9, rightDay: true,
  });
  assert(!tomorrow.ok && tomorrow.reason === 'inactive', 'a done handoff must never be picked up again');
});

// 2. Required clarification stays; it is never guessed away.
add('required clarification', () => {
  const kept = clarification.suppressOptionalClarification(
    'Find me roundtrip flights to Miami next month',
    'What city or airport are you flying from?'
  );
  assert(kept === 'What city or airport are you flying from?', 'a genuinely required detail must stay');
  const accountKept = clarification.suppressOptionalClarification(
    'Check my Gmail for the invoice from the contractor',
    'Which email account should I use?'
  );
  assert(accountKept === 'Which email account should I use?', 'an account-specific detail must stay');
});

// 3. Broad arbitrage never blocks on an optional narrowing question.
add('broad arbitrage without optional blocking question', () => {
  const note = 'Scan Target, Walmart and Ollies for resale opportunities on Amazon and eBay this week';
  assert(clarification.isBroadArbitrageScan(note), 'named-store resale scan must read as broad');
  const suppressed = clarification.suppressOptionalClarification(note, 'What product category should I focus on?');
  assertEqual(suppressed, '', 'optional category question must be suppressed for broad arbitrage');
});

// 4. Verified opportunity vs one-sided lead — exact evidence pages only.
add('verified opportunity vs one-sided lead', () => {
  const exactBuy = 'https://www.target.com/p/dyson-v8-absolute/-/A-123456789';
  const exactResale = 'https://www.amazon.com/dp/B0EXAMPLE1';
  const candidate = arbitrage.normalizeArbitrageCandidate({
    item_name: 'Dyson V8 Absolute', retailer: 'Target', marketplace: 'Amazon',
    buy_price: 199, resale_price: 299, estimated_fees: 30,
    buy_url: exactBuy, resale_url: exactResale,
  }, sanitizeUrlLike);
  assert(candidate !== null, 'both exact pages + positive spread must verify');
  assertEqual(candidate.estimated_profit, 70, 'profit math must be deterministic');
  assertEqual(candidate.net_buy_cost, 199, 'no coupon may be invented');

  const searchPage = arbitrage.normalizeArbitrageCandidate({
    item_name: 'Dyson V8 Absolute', retailer: 'Target', marketplace: 'Amazon',
    buy_price: 199, resale_price: 299, estimated_fees: 30,
    buy_url: exactBuy, resale_url: 'https://www.amazon.com/s?k=dyson+v8',
  }, sanitizeUrlLike);
  assert(searchPage === null, 'a resale search page must NEVER verify an opportunity');

  const lead = arbitrage.normalizeArbitrageLead({
    item_name: 'Dyson V8 Absolute', retailer: 'Target', marketplace: 'Amazon',
    buy_price: 199, buy_url: exactBuy, resale_url: '',
  }, sanitizeUrlLike);
  assert(lead !== null, 'one exact side must be kept as a lead');
  assert(lead.resale_price === 0 && lead.resale_url === '', 'a lead must never claim the missing side');
  assert(String(lead.missing_evidence).length > 0, 'a lead must say which evidence is missing');

  const bothSidesLead = arbitrage.normalizeArbitrageLead({
    item_name: 'Dyson V8 Absolute', retailer: 'Target', marketplace: 'Amazon',
    buy_price: 199, buy_url: exactBuy, resale_price: 299, resale_url: exactResale,
  }, sanitizeUrlLike);
  assert(bothSidesLead === null, 'a lead with both sides verified must graduate, not stay a lead');
});

// 5. Provider failure stays honest: no notification, no fake results.
add('provider failure honest recovery', () => {
  const onFailure = stateMachine.notifyVerdict({ shouldNotify: false, items: [], isArbitrageScan: true });
  assert(onFailure === false, 'a failed pipeline must never interrupt the person');
  const modelOverclaims = stateMachine.notifyVerdict({
    shouldNotify: true, items: [{ arbitrage_lead: { item_name: 'x' } }], isArbitrageScan: true,
  });
  assert(modelOverclaims === false, 'lead-only results must never be presented as verified success');
});

// 6. Duplicate run suppression: exactly one concurrent worker wins.
add('duplicate run suppression', async () => {
  const client = makeEntityClient({ b1: { id: 'b1', run_lock_at: '', run_token: '' } });
  const claims = await Promise.all([
    runLock.claimRunLock(client, 'b1'),
    runLock.claimRunLock(client, 'b1'),
  ]);
  const winners = claims.filter((c) => c.ok);
  assert(winners.length === 1, `exactly one concurrent claim must win, got ${winners.length}`);
  const freshClient = makeEntityClient({ b2: { id: 'b2', run_lock_at: new Date().toISOString(), run_token: 'someone-else' } });
  const busy = await runLock.claimRunLock(freshClient, 'b2');
  assert(!busy.ok && busy.reason === 'already_running', 'a fresh lock held by another worker must block a second runner');
});

// 7. Dependency failure blocks downstream steps and job completion.
add('dependency failure blocking', () => {
  const steps = [
    { id: 's1', status: 'completed' },
    { id: 's2', status: 'failed' },
    { id: 's3', status: 'pending', depends_on: ['s2'] },
  ];
  assertEqual(stateMachine.nextJobStatus(steps), 'failed', 'a failed step must fail the job, never complete it');
  assertEqual(
    stateMachine.nextJobStatus([{ id: 's1', status: 'completed' }, { id: 's2', status: 'waiting_approval' }]),
    'needs_approval',
    'an approval-gated step must keep the job waiting'
  );
  assertEqual(
    stateMachine.nextJobStatus([{ id: 's1', status: 'completed' }]),
    'completed',
    'all steps completed must complete the job'
  );
});

// 8. Approvals: success, failure, replay rejection, late-reject rejection.
add('approval required/success/failure/replay rejection', () => {
  const pending = {
    id: 'ap-1', owner_id: 'u1', approval_status: 'pending',
    action_type: 'email_send',
    action_payload: { recipient: 'a@example.com', subject: 'Hi', body: 'Hello' },
  };
  const ok = stateMachine.approvalVerdict(pending, 'u1', true);
  assert(ok.ok, 'the owner approving a pending write must be allowed');
  const rejectOk = stateMachine.approvalVerdict(pending, 'u1', false);
  assert(rejectOk.ok, 'the owner rejecting a pending write must be allowed');
  const replayed = stateMachine.approvalVerdict({ ...pending, approval_status: 'executed' }, 'u1', true);
  assert(!replayed.ok && replayed.status === 409, 'a replayed approval after execution must be refused');
  const lateReject = stateMachine.approvalVerdict({ ...pending, approval_status: 'executed' }, 'u1', false);
  assert(!lateReject.ok && lateReject.status === 409, 'a late reject must not rewrite an executed result');
  const notWaiting = stateMachine.approvalVerdict({ ...pending, approval_status: 'not_needed' }, 'u1', true);
  assert(!notWaiting.ok && notWaiting.status === 409, 'approving something not waiting must be refused');
  const failed = stateMachine.approvalVerdict({ ...pending, approval_status: 'failed' }, 'u1', true);
  assert(!failed.ok, 'a failed action cannot be blindly re-approved');
});

// 9. Scheduled repeat + pause behavior.
add('scheduled repeat and pause', () => {
  const repeat = {
    id: 'rep-1', owner_id: 'u1', status: 'active', run_mode: 'repeat',
    approval_status: 'not_needed', last_run_date: '', run_lock_at: '',
  };
  const due = stateMachine.schedulerRunVerdict({
    buddy: repeat, localDate: '2026-09-07', localHour: 10, scheduledHour: 9, rightDay: true,
  });
  assert(due.ok, 'a repeat handoff must run on its day after its hour');
  const wrongDay = stateMachine.schedulerRunVerdict({
    buddy: repeat, localDate: '2026-09-07', localHour: 10, scheduledHour: 9, rightDay: false,
  });
  assert(!wrongDay.ok && wrongDay.reason === 'not_scheduled_today', 'weekly/monthly repeats must not fire on the wrong day');
  const paused = stateMachine.schedulerRunVerdict({
    buddy: { ...repeat, status: 'paused' }, localDate: '2026-09-07', localHour: 10, scheduledHour: 9, rightDay: true,
  });
  assert(!paused.ok && paused.reason === 'inactive', 'a paused handoff must never run');
  const alreadyRan = stateMachine.schedulerRunVerdict({
    buddy: { ...repeat, last_run_date: '2026-09-07' }, localDate: '2026-09-07', localHour: 10, scheduledHour: 9, rightDay: true,
  });
  assert(!alreadyRan.ok && alreadyRan.reason === 'already_ran_today', 'a schedule must never run twice in one day');
  const tooEarly = stateMachine.schedulerRunVerdict({
    buddy: repeat, localDate: '2026-09-07', localHour: 8, scheduledHour: 9, rightDay: true,
  });
  assert(!tooEarly.ok && tooEarly.reason === 'not_due_yet', 'before the scheduled hour it must wait');
});

// 10. Watch unchanged = quiet: no notification without a real change.
add('watch unchanged = no notification', () => {
  assert(
    stateMachine.notifyVerdict({ shouldNotify: false, items: [], isArbitrageScan: false }) === false,
    'an unchanged watch must stay quiet'
  );
  assert(
    stateMachine.notifyVerdict({ shouldNotify: true, items: [{ arbitrage: { item_name: 'x' } }], isArbitrageScan: true }) === true,
    'a verified opportunity may interrupt'
  );
});

// 11. Rate limit + upgrade routing.
add('rate limit and upgrade routing', () => {
  const now = Date.now();
  const future = new Date(now + 60 * 1000).toISOString();
  assert(rateLimit.bucketAllows({ count: 4, expires_at: future }, 5, now) === true, 'under the limit must be allowed');
  assert(rateLimit.bucketAllows({ count: 5, expires_at: future }, 5, now) === false, 'at the limit must be refused');
  const stale = new Date(now - 60 * 1000).toISOString();
  assert(rateLimit.bucketAllows({ count: 5, expires_at: stale }, 5, now) === true, 'a stale bucket must not block');

  const atLimit = stateMachine.freeHandoffVerdict({ plan: 'free', role: 'user', existingCount: 3 });
  assert(!atLimit.ok && atLimit.upgrade_required === true, 'the fourth free handoff must route to upgrade');
  assert(stateMachine.freeHandoffVerdict({ plan: 'free', role: 'user', existingCount: 2 }).ok, 'three free handoffs are allowed');
  assert(stateMachine.freeHandoffVerdict({ plan: 'pro', role: 'user', existingCount: 50 }).ok, 'pro is unlimited');
  assert(stateMachine.freeHandoffVerdict({ plan: 'free', role: 'admin', existingCount: 50 }).ok, 'admins are unlimited');
});

// 12. Payment webhook replay and out-of-order events.
add('payment webhook replay', () => {
  assert(stateMachine.purchaseEventVerdict('pending').process === true, 'a pending purchase must be fulfilled');
  assert(stateMachine.purchaseEventVerdict('paid').process === false, 'a replayed ORDER_APPROVED must not grant twice');
  assert(stateMachine.purchaseEventVerdict('canceled').process === false, 'a late approval must not resurrect a canceled subscription');
});

// 13. Cross-user access/approval rejection.
add('cross-user approval rejection', () => {
  const theirs = { id: 'x-1', owner_id: 'u1', approval_status: 'pending' };
  const verdict = stateMachine.approvalVerdict(theirs, 'u2', true);
  assert(!verdict.ok && verdict.status === 403, 'another user must never approve someone else\'s handoff');
  const verdictReject = stateMachine.approvalVerdict(theirs, 'u2', false);
  assert(!verdictReject.ok && verdictReject.status === 403, 'another user must never reject someone else\'s handoff');
  assert(stateMachine.approvalVerdict(null, 'u2', true).status === 404, 'a missing handoff is 404');
});

// 14. Stale job recovery: a crashed worker never strands the handoff.
add('stale job recovery', async () => {
  const staleLockAt = new Date(Date.now() - 11 * 60 * 1000).toISOString();
  assert(stateMachine.isRunLockFresh(staleLockAt) === false, 'a lock past the TTL is stale');
  const client = makeEntityClient({ 'stale-1': { id: 'stale-1', run_lock_at: staleLockAt, run_token: 'crashed-worker' } });
  const reclaimed = await runLock.claimRunLock(client, 'stale-1');
  assert(reclaimed.ok, 'a crashed worker\'s stale lock must be reclaimable');
  assert(stateMachine.isRunLockFresh(new Date().toISOString()) === true, 'a fresh lock is held');
});

// 15. Duplicate create suppression (idempotent create by client token).
add('duplicate create suppression', () => {
  const original = { id: 'b-1', name: 'Cheap chicken' };
  const dupe = stateMachine.duplicateCreateVerdict([original]);
  assert(dupe.duplicate && dupe.buddy.id === 'b-1', 'a replayed client token must return the original record');
  const fresh = stateMachine.duplicateCreateVerdict([]);
  assert(!fresh.duplicate && fresh.buddy === null, 'a new token must create normally');
});

for (const [name, fn] of scenarios) {
  await scenario(name, fn);
}

for (const [name, status] of results) {
  // eslint-disable-next-line no-console
  console.log(status === 'PASS' ? `PASS ${name}` : `FAIL ${name}`);
}
const failLines = results.filter(([, status]) => status === 'FAIL');
for (const [name, , message] of failLines) {
  // eslint-disable-next-line no-console
  console.error(`  ${name}: ${message}`);
}
// eslint-disable-next-line no-console
console.log(`\nMechanics gate: ${results.length - failedCount}/${results.length} scenarios passed`);
process.exit(failedCount > 0 ? 1 : 0);
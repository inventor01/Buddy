import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { INTELLIGENCE_GATE_CASES, structuralGateScore } from '../../shared/intelligenceGate.ts';
import { orchestrationReadiness, planOrchestration, runOrchestratedBuddy } from '../../shared/orchestrator.ts';

const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'number' },
    pass: { type: 'boolean' },
    critical_fact_failure: { type: 'boolean' },
    notes: { type: 'string' },
  },
  required: ['score','pass','critical_fact_failure','notes'],
};

function cleanCase(row: any) {
  return {
    id: String(row?.id || '').slice(0, 40),
    category: String(row?.category || '').slice(0, 50),
    prompt: String(row?.prompt || '').slice(0, 1200),
    status: String(row?.status || '').slice(0, 30),
    score: Math.min(1, Math.max(0, Number(row?.score) || 0)),
    notes: String(row?.notes || '').slice(0, 1000),
    providers: Array.isArray(row?.providers) ? row.providers.slice(0, 10).map((x: any) => String(x).slice(0, 60)) : [],
    latency_ms: Math.max(0, Number(row?.latency_ms) || 0),
  };
}

async function latestStatus(base44: any) {
  const [runs, scores] = await Promise.all([
    base44.asServiceRole.entities.IntelligenceGateRun.filter({}, '-started_at', 1),
    base44.asServiceRole.entities.ProviderPerformance.filter({}, '-score', 100),
  ]);
  return {
    latest: Array.isArray(runs) ? runs[0] || null : null,
    provider_scores: Array.isArray(scores) ? scores.map((s: any) => ({
      provider: s.provider,
      capability: s.capability,
      runs: Number(s.runs) || 0,
      successes: Number(s.successes) || 0,
      failures: Number(s.failures) || 0,
      verified_successes: Number(s.verified_successes) || 0,
      fallbacks: Number(s.fallbacks) || 0,
      avg_latency_ms: Number(s.avg_latency_ms) || 0,
      score: Number(s.score) || 0,
      last_used_at: s.last_used_at || '',
    })) : [],
    specialists: orchestrationReadiness(),
    total_cases: INTELLIGENCE_GATE_CASES.length,
  };
}

async function judgeLiveCase(base44: any, testCase: any, final: any, job: any) {
  const evidence = Array.isArray(job?.steps) ? job.steps.map((s: any) => ({
    kind: s.kind,
    provider: s.provider,
    status: s.status,
    evidence_urls: s.evidence_urls || [],
    confidence: s.confidence,
    output: String(s.output || '').slice(0, 3500),
  })) : [];
  const judged = await base44.asServiceRole.integrations.Core.InvokeLLM({
    model: 'gemini_3_flash',
    prompt: [
      'You are evaluating a consumer task-handling system. Grade only against the supplied evidence; do not reward fluent unsupported claims.',
      `Request: ${testCase.prompt}`,
      `Final result: ${JSON.stringify(final?.findings || []).slice(0, 12000)}`,
      `Verification summary: ${String(final?.verification_summary || '').slice(0, 2000)}`,
      `Specialist evidence: ${JSON.stringify(evidence).slice(0, 24000)}`,
      'Score 0 to 1. Pass requires >=0.80, correct constraint preservation, useful completion, and no unsupported critical price/date/address/availability claim. Set critical_fact_failure=true for any fabricated or materially unsupported critical fact.',
    ].join('\n'),
    response_json_schema: JUDGE_SCHEMA,
  });
  const score = Math.min(1, Math.max(0, Number(judged?.score) || 0));
  const critical = judged?.critical_fact_failure === true;
  return {
    score,
    pass: judged?.pass === true && score >= 0.8 && !critical,
    critical,
    notes: String(judged?.notes || '').slice(0, 1000),
  };
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only.' }, { status: 403 });

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const action = String(body?.action || 'status');
    if (action === 'status') return Response.json(await latestStatus(base44));
    if (action !== 'run') return Response.json({ error: 'Use action=status or action=run.' }, { status: 400 });

    const mode = body?.mode === 'live' ? 'live' : 'structural';
    const requestedIds = Array.isArray(body?.case_ids) ? new Set(body.case_ids.map((x: any) => String(x))) : null;
    const maxCases = Math.min(25, Math.max(1, Number(body?.max_cases) || (mode === 'live' ? 5 : 25)));
    const selected = INTELLIGENCE_GATE_CASES.filter((c) => !requestedIds || requestedIds.has(c.id)).slice(0, maxCases);
    if (!selected.length) return Response.json({ error: 'No matching gate cases.' }, { status: 400 });

    const gate = await base44.asServiceRole.entities.IntelligenceGateRun.create({
      started_at: new Date().toISOString(),
      status: 'running',
      total_cases: selected.length,
      passed_cases: 0,
      failed_cases: 0,
      pass_rate: 0,
      critical_fact_failures: 0,
      cases: [],
    });

    const results: any[] = [];
    let criticalFailures = 0;
    for (const testCase of selected) {
      const started = Date.now();
      try {
        const buddy = {
          id: `gate-${gate.id}-${testCase.id}`,
          owner_id: user.id,
          note: testCase.prompt,
          what_line: testCase.prompt,
          run_mode: 'once',
          kind: 'web',
          context: [],
        };
        const plan = await planOrchestration(base44, buddy, [], []);
        const structural = structuralGateScore(plan, testCase);

        if (mode !== 'live' || testCase.liveSafe !== true) {
          results.push(cleanCase({
            id: testCase.id,
            category: testCase.category,
            prompt: testCase.prompt,
            status: structural.pass ? 'passed' : 'failed',
            score: structural.score,
            notes: structural.notes || (mode === 'live' && !testCase.liveSafe ? 'Structural-only because this case involves private context, ambiguity, or a consequential action.' : ''),
            providers: [],
            latency_ms: Date.now() - started,
          }));
        } else {
          const final = await runOrchestratedBuddy({ base44, buddy, personalFacts: [], delegationLines: [] });
          const jobs = await base44.asServiceRole.entities.BuddyJob.filter({ buddy_id: buddy.id, owner_id: user.id }, '-started_at', 1);
          const job = Array.isArray(jobs) ? jobs[0] || null : null;
          const judged = await judgeLiveCase(base44, testCase, final, job);
          if (judged.critical) criticalFailures += 1;
          const combined = Math.round((structural.score * 0.25 + judged.score * 0.75) * 100) / 100;
          const pass = structural.pass && judged.pass && combined >= 0.8;
          results.push(cleanCase({
            id: testCase.id,
            category: testCase.category,
            prompt: testCase.prompt,
            status: pass ? 'passed' : 'failed',
            score: combined,
            notes: [structural.notes, judged.notes].filter(Boolean).join(' | '),
            providers: job?.providers_used || final?.orchestration?.providers || [],
            latency_ms: Date.now() - started,
          }));
        }
      } catch (error: any) {
        results.push(cleanCase({
          id: testCase.id,
          category: testCase.category,
          prompt: testCase.prompt,
          status: 'failed',
          score: 0,
          notes: String(error?.message || error).slice(0, 1000),
          providers: [],
          latency_ms: Date.now() - started,
        }));
      }
      await base44.asServiceRole.entities.IntelligenceGateRun.update(gate.id, { cases: results });
    }

    const passed = results.filter((r) => r.status === 'passed').length;
    const failed = results.length - passed;
    const passRate = results.length ? Math.round((passed / results.length) * 1000) / 10 : 0;
    const status = failed === 0 || (passRate >= 90 && criticalFailures === 0) ? 'completed' : 'failed';
    const completed = await base44.asServiceRole.entities.IntelligenceGateRun.update(gate.id, {
      completed_at: new Date().toISOString(),
      status,
      passed_cases: passed,
      failed_cases: failed,
      pass_rate: passRate,
      critical_fact_failures: criticalFailures,
      cases: results,
    });

    return Response.json({ gate: completed, mode, target: '>=90% pass rate and zero critical fact failures', specialists: orchestrationReadiness() });
  } catch (error: any) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
}

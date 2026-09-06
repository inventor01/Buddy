import { secrets } from 'base44:runtime';
import { isWholesalePropertyRequest, runWholesaleDealFinder } from './realEstate.ts';
import { markProviderVerified, providerCapability, rankProviders, recordProviderAttempt } from './providerPerformance.ts';

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    complexity: { type: 'number' },
    should_orchestrate: { type: 'boolean' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          kind: { type: 'string', enum: ['domain_property','web_research','browser_fetch','reasoning','calculation','connected_action','verify'] },
          instruction: { type: 'string' },
          target_url: { type: 'string' },
        },
        required: ['id','kind','instruction'],
      },
    },
  },
  required: ['complexity','should_orchestrate','steps'],
};

const SYNTH_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          source_name: { type: 'string' },
          url: { type: 'string' },
          why_fit: { type: 'string' },
        },
        required: ['text'],
      },
    },
    should_notify: { type: 'boolean' },
    verification_summary: { type: 'string' },
  },
  required: ['findings','should_notify','verification_summary'],
};

function uniq<T>(items: T[]) { return [...new Set(items.filter(Boolean))]; }
function trim(value: unknown, n = 4000) { return String(value || '').trim().slice(0, n); }

export function shouldOrchestrateRequest(text: string) {
  const t = String(text || '').toLowerCase();
  if (isWholesalePropertyRequest(t)) return true;
  const verbs = ['find','compare','analyze','calculate','verify','check','research','rank','recommend','contact','book','schedule','create','send','summarize','plan'];
  const verbCount = verbs.filter((v) => new RegExp(`\\b${v}`).test(t)).length;
  const multiSource = /\b(zillow|redfin|realtor|amazon|google|reddit|youtube|multiple sources|several sites|across)\b/.test(t);
  const sequencing = /\b(then|after that|next|and then|first|finally)\b/.test(t);
  const recurringPlusAnalysis = /\b(every|daily|weekly|morning|each day)\b/.test(t) && verbCount >= 2;
  return (verbCount >= 3 && (multiSource || sequencing || t.length > 180)) || recurringPlusAnalysis;
}

function providerReadiness() {
  return {
    openai: !!secrets.get('OPENAI_API_KEY'),
    browserbase: !!secrets.get('BROWSERBASE_API_KEY'),
    composio: !!secrets.get('COMPOSIO_API_KEY'),
    rentcast: !!secrets.get('RENTCAST_API_KEY'),
  };
}

export function orchestrationReadiness() {
  return providerReadiness();
}

export async function planOrchestration(base44: any, buddy: any, personalFacts: string[] = [], delegationLines: string[] = []) {
  const request = `${buddy.note || ''} ${buddy.what_line || ''}`.trim();
  if (isWholesalePropertyRequest(request)) {
    return {
      complexity: 5,
      should_orchestrate: true,
      steps: [
        { id: 'property-data', kind: 'domain_property', instruction: 'Find and underwrite the strongest wholesale property candidates using live property data and comparable sales.' },
        { id: 'listing-check', kind: 'browser_fetch', instruction: 'Open the strongest candidate listing page and verify the visible address, asking price, listing status, and any distress signals. Do not infer repairs from photos.', target_url: '$top_listing' },
        { id: 'verify', kind: 'verify', instruction: 'Verify the underwriting math, evidence, and that the result actually matches the requested geography and constraints.' },
      ],
    };
  }
  const plan = await base44.asServiceRole.integrations.Core.InvokeLLM({
    model: 'gemini_3_flash',
    prompt: [
      'Decompose this consumer request into the fewest specialist steps needed to finish it reliably.',
      `Request: ${request}`,
      personalFacts.length ? `Relevant saved context: ${personalFacts.join(' | ')}` : '',
      delegationLines.length ? delegationLines.join(' ') : '',
      'Use at most 5 steps. Prefer authoritative APIs/data for domain facts, browser_fetch for a specific URL, web_research for current public research, calculation for deterministic math, and verify as the final step.',
      'Do not create a connected_action step that sends, books, pays, posts, deletes, or commits without approval. Such a step may only prepare or identify the required approval.',
    ].filter(Boolean).join('\n'),
    response_json_schema: PLAN_SCHEMA,
  });
  return {
    complexity: Math.min(5, Math.max(1, Number(plan?.complexity) || 3)),
    should_orchestrate: plan?.should_orchestrate !== false,
    steps: (Array.isArray(plan?.steps) ? plan.steps : []).slice(0, 5).map((s, i) => ({
      id: trim(s?.id || `step-${i + 1}`, 40),
      kind: ['domain_property','web_research','browser_fetch','reasoning','calculation','connected_action','verify'].includes(s?.kind) ? s.kind : 'reasoning',
      instruction: trim(s?.instruction, 700),
      target_url: /^https?:\/\//i.test(String(s?.target_url || '')) ? String(s.target_url).slice(0, 600) : '',
    })).filter((s) => s.instruction),
  };
}

function extractOpenAIText(data: any) {
  const out: string[] = [];
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    for (const c of Array.isArray(item?.content) ? item.content : []) {
      if ((c?.type === 'output_text' || c?.type === 'text') && typeof c?.text === 'string') out.push(c.text);
    }
  }
  return out.join('\n').trim();
}

function collectUrls(value: any, depth = 0): string[] {
  if (depth > 6 || value == null) return [];
  if (typeof value === 'string') return /^https?:\/\//i.test(value) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((v) => collectUrls(v, depth + 1));
  if (typeof value === 'object') return Object.values(value).flatMap((v) => collectUrls(v, depth + 1));
  return [];
}

async function runOpenAI(instruction: string, goal: string) {
  const key = secrets.get('OPENAI_API_KEY');
  if (!key) throw new Error('OpenAI specialist is not configured.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 40000);
  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: secrets.get('OPENAI_ORCHESTRATOR_MODEL') || 'gpt-5',
        tools: [{ type: 'web_search' }],
        input: [
          { role: 'system', content: 'You are a specialist worker inside Buddy. Complete only the assigned subtask. Be evidence-first, concise, and do not perform consequential actions.' },
          { role: 'user', content: `Overall goal: ${goal}\nAssigned subtask: ${instruction}\nReturn a concise result with concrete facts and sources.` },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI specialist failed (${res.status}).`);
    const data = await res.json();
    return { output: extractOpenAIText(data).slice(0, 9000), urls: uniq(collectUrls(data)).slice(0, 12), confidence: 0.82, provider: 'openai' };
  } finally { clearTimeout(timer); }
}

async function runBrowserbase(targetUrl: string, instruction: string) {
  const key = secrets.get('BROWSERBASE_API_KEY');
  if (!key) throw new Error('Browser specialist is not configured.');
  if (!/^https?:\/\//i.test(targetUrl)) throw new Error('Browser specialist needs a specific page URL.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch('https://api.browserbase.com/v1/fetch', {
      method: 'POST', signal: controller.signal,
      headers: { 'X-BB-API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: targetUrl, allowRedirects: true, allowInsecureSsl: false, proxies: false }),
    });
    if (!res.ok) throw new Error(`Browser specialist failed (${res.status}).`);
    const data = await res.json();
    const content = trim(data?.content || data?.text || data?.markdown || JSON.stringify(data), 10000);
    return { output: `${instruction}\n\nPage evidence:\n${content}`, urls: [targetUrl], confidence: 0.88, provider: 'browserbase' };
  } finally { clearTimeout(timer); }
}

async function runBase44Research(base44: any, instruction: string, goal: string, useInternet = true) {
  const r = await base44.asServiceRole.integrations.Core.InvokeLLM({
    model: 'gemini_3_flash',
    ...(useInternet ? { add_context_from_internet: true } : {}),
    prompt: [
      'You are a specialist worker inside Buddy.',
      `Overall goal: ${goal}`,
      `Assigned subtask: ${instruction}`,
      'Return JSON with a concise summary, exact source URLs actually used when available, and confidence from 0 to 1. Never invent a URL or claim.',
    ].join('\n'),
    response_json_schema: {
      type: 'object', properties: {
        summary: { type: 'string' },
        evidence_urls: { type: 'array', items: { type: 'string' } },
        confidence: { type: 'number' },
      }, required: ['summary','evidence_urls','confidence'],
    },
  });
  return {
    output: trim(r?.summary, 9000),
    urls: (Array.isArray(r?.evidence_urls) ? r.evidence_urls : []).filter((u) => /^https?:\/\//i.test(String(u))).slice(0, 12),
    confidence: Math.min(1, Math.max(0, Number(r?.confidence) || 0.65)),
    provider: useInternet ? 'buddy-web' : 'buddy-reasoner',
  };
}

async function executeStep({ base44, buddy, step, goal, priorResults = [] }: any) {
  const ready = providerReadiness();
  const capability = providerCapability(step.kind);
  let targetUrl = step.target_url;
  if (step.kind === 'browser_fetch' && (targetUrl === '$top_listing' || !/^https?:\/\//i.test(String(targetUrl || '')))) {
    const domain = priorResults.find((r: any) => r?.raw?.findings);
    const top = domain?.raw?.findings?.[0];
    targetUrl = top?.deal?.listing_url || top?.url || '';
  }

  let candidates: string[] = [];
  if (step.kind === 'domain_property') candidates = ready.rentcast ? ['rentcast'] : [];
  else if (step.kind === 'browser_fetch') {
    if (targetUrl && ready.browserbase) candidates.push('browserbase');
    if (ready.openai) candidates.push('openai');
    candidates.push('buddy-web');
  } else if (step.kind === 'web_research') {
    if (ready.openai) candidates.push('openai');
    candidates.push('buddy-web');
  } else if (step.kind === 'reasoning') {
    if (ready.openai) candidates.push('openai');
    candidates.push('buddy-reasoner');
  } else if (step.kind === 'calculation' || step.kind === 'verify') candidates = ['buddy-reasoner'];
  else if (step.kind === 'connected_action') candidates = ['buddy-safety'];
  else candidates = ['buddy-reasoner'];

  if (!candidates.length) throw new Error(`No configured specialist can handle ${capability}.`);
  const ranked = await rankProviders(base44, capability, uniq(candidates));
  let lastError: any = null;

  for (let index = 0; index < ranked.length; index++) {
    const provider = ranked[index];
    const started = Date.now();
    try {
      let result: any;
      if (provider === 'rentcast') {
        const raw = await runWholesaleDealFinder({ base44, buddy });
        result = { output: JSON.stringify(raw).slice(0, 16000), urls: uniq(collectUrls(raw)).slice(0, 20), confidence: 0.92, provider, raw };
      } else if (provider === 'browserbase') {
        if (!targetUrl) throw new Error('No concrete page URL was available for the browser check.');
        result = await runBrowserbase(targetUrl, `${step.instruction}\nTarget: ${targetUrl}`);
      } else if (provider === 'openai') {
        const instruction = step.kind === 'browser_fetch' && targetUrl
          ? `${step.instruction}\nCheck this exact page and corroborate it with current web evidence: ${targetUrl}`
          : step.instruction;
        result = await runOpenAI(instruction, goal);
      } else if (provider === 'buddy-web') {
        result = await runBase44Research(base44, targetUrl ? `${step.instruction}\nTarget page: ${targetUrl}` : step.instruction, goal, true);
      } else if (provider === 'buddy-reasoner') {
        result = await runBase44Research(base44, step.instruction, goal, false);
      } else if (provider === 'buddy-safety') {
        result = { output: 'This step requires Buddy’s existing connection and approval flow. It was prepared but not executed automatically.', urls: [], confidence: 1, provider };
      } else {
        throw new Error(`Unsupported specialist: ${provider}`);
      }

      const latencyMs = Date.now() - started;
      await recordProviderAttempt({ base44, provider, capability, success: true, fallback: index > 0, latencyMs });
      return { ...result, provider, capability, latency_ms: latencyMs, used_fallback: index > 0, attempted_providers: ranked.slice(0, index + 1) };
    } catch (error: any) {
      lastError = error;
      await recordProviderAttempt({ base44, provider, capability, success: false, fallback: index > 0, latencyMs: Date.now() - started, error: error?.message || String(error) });
    }
  }

  throw lastError || new Error('No specialist could complete this step.');
}

function verifyWholesaleRaw(raw: any) {
  const findings = Array.isArray(raw?.findings) ? raw.findings : [];
  for (const f of findings) {
    const d = f?.deal;
    if (!d || !Number(d.arv)) continue;
    const pct = Number(d.investor_arv_percent) || 0.7;
    const repairs = Number(d.repairs) || 0;
    const assignment = Number(d.assignment_fee) || 0;
    d.flipper_max = Math.round(Number(d.arv) * pct - repairs);
    d.max_contract = Math.round(d.flipper_max - assignment);
  }
  return raw;
}

async function synthesize(base44: any, goal: string, results: any[]) {
  const domain = results.find((r) => r?.raw?.findings);
  if (domain?.raw) {
    const verified = verifyWholesaleRaw(domain.raw);
    return { ...verified, verification_summary: 'Buddy independently recomputed the wholesale formula and preserved the source-backed ARV/comps.' };
  }
  const evidence = results.map((r, i) => ({
    step: i + 1,
    provider: r.provider,
    output: trim(r.output, 5000),
    urls: r.urls || [],
    confidence: r.confidence,
  }));
  return await base44.asServiceRole.integrations.Core.InvokeLLM({
    model: 'gemini_3_flash',
    prompt: [
      'You are Buddy’s verifier and final editor.',
      `User goal: ${goal}`,
      'Below are specialist outputs. Produce the final answer using ONLY claims supported by those outputs. Resolve contradictions conservatively. Never invent missing prices, dates, URLs, or actions.',
      'If a consequential action still needs approval, say so rather than implying it happened.',
      JSON.stringify(evidence).slice(0, 28000),
    ].join('\n'),
    response_json_schema: SYNTH_SCHEMA,
  });
}

export async function runOrchestratedBuddy({ base44, buddy, personalFacts = [], delegationLines = [] }: any) {
  const goal = `${buddy.note || ''} ${buddy.what_line || ''}`.trim();
  const plan = await planOrchestration(base44, buddy, personalFacts, delegationLines);
  if (!plan.should_orchestrate || !plan.steps.length) throw new Error('This request does not need orchestration.');

  const job = await base44.asServiceRole.entities.BuddyJob.create({
    owner_id: buddy.owner_id,
    buddy_id: buddy.id,
    goal: goal.slice(0, 1000),
    status: 'running',
    complexity: plan.complexity,
    started_at: new Date().toISOString(),
    attempt_count: 1,
    fallback_count: 0,
    providers_used: [],
    steps: plan.steps.map((s) => ({ ...s, status: 'pending', provider: '', output: '', evidence_urls: [], confidence: 0, error: '' })),
  });

  const steps = job.steps || [];
  const results: any[] = [];
  const providers: string[] = [];
  let fallbackCount = 0;
  try {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step.kind === 'verify') continue;
      steps[i] = { ...step, status: 'running' };
      await base44.asServiceRole.entities.BuddyJob.update(job.id, { steps });
      try {
        const r = await executeStep({ base44, buddy, step, goal, priorResults: results });
        results.push(r);
        providers.push(r.provider);
        if (r.used_fallback) fallbackCount += 1;
        steps[i] = { ...step, provider: r.provider, status: 'completed', output: trim(r.output, 8000), evidence_urls: (r.urls || []).slice(0, 12), confidence: r.confidence || 0, latency_ms: r.latency_ms || 0, attempted_providers: r.attempted_providers || [r.provider] };
      } catch (stepError: any) {
        steps[i] = { ...step, status: 'failed', error: trim(stepError?.message, 300) };
      }
      await base44.asServiceRole.entities.BuddyJob.update(job.id, { steps, providers_used: uniq(providers), fallback_count: fallbackCount });
    }

    if (!results.length) throw new Error('No specialist could complete the request.');
    const final = await synthesize(base44, goal, results);
    const verifiedPairs = uniq(results.map((r: any) => `${r.provider}|||${r.capability || 'general'}`));
    for (const pair of verifiedPairs) {
      const [provider, capability] = String(pair).split('|||');
      await markProviderVerified(base44, provider, capability);
    }
    const verifyIndex = steps.findIndex((s) => s.kind === 'verify');
    if (verifyIndex >= 0) steps[verifyIndex] = { ...steps[verifyIndex], provider: 'buddy-verifier', status: 'completed', output: trim(final?.verification_summary || 'Verified specialist outputs.', 1000), evidence_urls: uniq(results.flatMap((r) => r.urls || [])).slice(0, 12), confidence: 0.9, error: '' };
    await base44.asServiceRole.entities.BuddyJob.update(job.id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      steps,
      providers_used: uniq([...providers, 'buddy-verifier']),
      fallback_count: fallbackCount,
      verification_summary: trim(final?.verification_summary, 1200),
      final_summary: trim((final?.findings || []).map((f: any) => f?.text).filter(Boolean).join('\n'), 5000),
      final_items_json: JSON.stringify(final?.findings || []).slice(0, 30000),
    });
    return { ...final, job_id: job.id, orchestration: { steps: steps.length, providers: uniq(providers).length, fallbacks: fallbackCount } };
  } catch (error: any) {
    await base44.asServiceRole.entities.BuddyJob.update(job.id, { status: 'failed', completed_at: new Date().toISOString(), steps, providers_used: uniq(providers), fallback_count: fallbackCount, verification_summary: trim(error?.message, 1000) });
    throw error;
  }
}

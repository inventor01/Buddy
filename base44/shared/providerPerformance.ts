function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

const DEFAULT_PRIORS: Record<string, number> = {
  rentcast: 0.84,
  browserbase: 0.78,
  openai: 0.76,
  'buddy-web': 0.68,
  'buddy-reasoner': 0.7,
  'buddy-safety': 0.95,
  'buddy-verifier': 0.9,
};

export function providerCapability(stepKind: string) {
  switch (stepKind) {
    case 'domain_property': return 'property_data';
    case 'browser_fetch': return 'browser';
    case 'web_research': return 'web_research';
    case 'reasoning': return 'reasoning';
    case 'calculation': return 'calculation';
    case 'connected_action': return 'connected_action';
    case 'verify': return 'verification';
    default: return 'general';
  }
}

export function computeProviderScore(row: any) {
  const runs = Math.max(0, Number(row?.runs) || 0);
  const successes = Math.max(0, Number(row?.successes) || 0);
  const verified = Math.max(0, Number(row?.verified_successes) || 0);
  const fallbacks = Math.max(0, Number(row?.fallbacks) || 0);
  const avgLatency = Math.max(0, Number(row?.avg_latency_ms) || 0);

  // Bayesian-ish smoothing keeps a provider from becoming the permanent
  // winner or loser after only one run. Verification matters more than speed.
  const successRate = (successes + 3) / (runs + 4);
  const verifiedRate = (verified + 1) / (successes + 2);
  const fallbackRate = runs ? fallbacks / runs : 0;
  const latencyScore = avgLatency ? clamp(1 - avgLatency / 60000) : 0.65;
  const sampleConfidence = clamp(runs / 20);

  const score =
    0.55 * successRate +
    0.24 * verifiedRate +
    0.11 * latencyScore +
    0.10 * sampleConfidence -
    0.16 * fallbackRate;

  return clamp(score, 0.05, 0.99);
}

export async function loadProviderScores(base44: any, capability: string, providers: string[]) {
  const out: Record<string, { score: number; runs: number }> = {};
  for (const provider of providers) {
    const fallback = DEFAULT_PRIORS[provider] ?? 0.6;
    try {
      const rows = await base44.asServiceRole.entities.ProviderPerformance.filter({ provider, capability }, '-updated_date', 1);
      const row = Array.isArray(rows) ? rows[0] : null;
      out[provider] = row
        ? { score: Number(row.score) || computeProviderScore(row), runs: Number(row.runs) || 0 }
        : { score: fallback, runs: 0 };
    } catch (_) {
      out[provider] = { score: fallback, runs: 0 };
    }
  }
  return out;
}

export async function rankProviders(base44: any, capability: string, providers: string[]) {
  const scores = await loadProviderScores(base44, capability, providers);
  return [...providers].sort((a, b) => {
    const as = scores[a] || { score: DEFAULT_PRIORS[a] ?? 0.6, runs: 0 };
    const bs = scores[b] || { score: DEFAULT_PRIORS[b] ?? 0.6, runs: 0 };
    // Until a worker has at least five real attempts, blend its learned score
    // with the prior instead of letting tiny samples dominate routing.
    const blended = (provider: string, s: { score: number; runs: number }) => {
      const prior = DEFAULT_PRIORS[provider] ?? 0.6;
      const weight = clamp(s.runs / 5);
      return prior * (1 - weight) + s.score * weight;
    };
    return blended(b, bs) - blended(a, as);
  });
}

export async function recordProviderAttempt({
  base44,
  provider,
  capability,
  success,
  verified = false,
  fallback = false,
  latencyMs = 0,
  error = '',
}: any) {
  if (!provider || !capability) return;
  try {
    const rows = await base44.asServiceRole.entities.ProviderPerformance.filter({ provider, capability }, '-updated_date', 1);
    const current = Array.isArray(rows) ? rows[0] || null : null;
    const runs = (Number(current?.runs) || 0) + 1;
    const successes = (Number(current?.successes) || 0) + (success ? 1 : 0);
    const failures = (Number(current?.failures) || 0) + (success ? 0 : 1);
    const verifiedSuccesses = (Number(current?.verified_successes) || 0) + (success && verified ? 1 : 0);
    const fallbacks = (Number(current?.fallbacks) || 0) + (fallback ? 1 : 0);
    const totalLatency = (Number(current?.total_latency_ms) || 0) + Math.max(0, Number(latencyMs) || 0);
    const next: any = {
      provider,
      capability,
      runs,
      successes,
      failures,
      verified_successes: verifiedSuccesses,
      fallbacks,
      total_latency_ms: totalLatency,
      avg_latency_ms: Math.round(totalLatency / runs),
      last_error: success ? '' : String(error || '').slice(0, 300),
      last_used_at: new Date().toISOString(),
    };
    next.score = computeProviderScore(next);
    if (current?.id) await base44.asServiceRole.entities.ProviderPerformance.update(current.id, next);
    else await base44.asServiceRole.entities.ProviderPerformance.create(next);
  } catch (_) {
    // Scoring must never make a user's actual request fail.
  }
}

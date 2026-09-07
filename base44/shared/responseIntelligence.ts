const RESPONSE_INTELLIGENCE_SCHEMA = {
  type: 'object',
  properties: {
    bottom_line: { type: 'string' },
    best_next_move: { type: 'string' },
    uncertainty: { type: 'string' },
    confidence: { type: 'string', enum: ['high','medium','low'] },
  },
  required: ['bottom_line','best_next_move','uncertainty','confidence'],
};

function clean(value: unknown, max = 280) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function compactItem(item: any) {
  if (!item || typeof item !== 'object') return null;
  const out: any = {
    text: clean(item.text, 220),
    source: clean(item.source, 80),
    url: clean(item.url, 500),
    why_fit: clean(item.why_fit, 140),
  };
  if (item.arbitrage) {
    out.arbitrage = {
      item_name: clean(item.arbitrage.item_name, 120),
      retailer: clean(item.arbitrage.retailer, 60),
      marketplace: clean(item.arbitrage.marketplace, 60),
      action_tier: clean(item.arbitrage.action_tier, 30),
      actionability_score: Number(item.arbitrage.actionability_score) || 0,
      net_buy_cost: Number(item.arbitrage.net_buy_cost) || 0,
      resale_price: Number(item.arbitrage.resale_price) || 0,
      estimated_profit: Number(item.arbitrage.estimated_profit) || 0,
      roi_percent: Number(item.arbitrage.roi_percent) || 0,
      units_to_target: Number(item.arbitrage.units_to_target) || 0,
      demand_note: clean(item.arbitrage.demand_note, 220),
      coupon_dependent: item.arbitrage.coupon_dependent === true,
      caveat: clean(item.arbitrage.caveat, 260),
    };
  }
  if (item.arbitrage_lead) {
    out.arbitrage_lead = {
      item_name: clean(item.arbitrage_lead.item_name, 120),
      retailer: clean(item.arbitrage_lead.retailer, 60),
      marketplace: clean(item.arbitrage_lead.marketplace, 60),
      identifier: clean(item.arbitrage_lead.identifier, 100),
      buy_price: Number(item.arbitrage_lead.buy_price) || 0,
      resale_price: Number(item.arbitrage_lead.resale_price) || 0,
      missing_evidence: clean(item.arbitrage_lead.missing_evidence, 200),
      confidence: Number(item.arbitrage_lead.confidence) || 0,
    };
  }
  if (item.deal) out.deal = item.deal;
  if (item.product) out.product = item.product;
  return out;
}

export function shouldUseResponseIntelligence(request: unknown, items: any[]) {
  const text = String(request || '').toLowerCase();
  if (!Array.isArray(items) || !items.length) return false;
  if (/\b(remind|reminder|timer|alarm)\b/.test(text) && items.length <= 1) return false;
  if (items.some((item) => item?.arbitrage || item?.arbitrage_lead)) return true;
  const decisionIntent = /\b(best|choose|compare|rank|recommend|should i|worth|priority|prioritize|what should|next step|opportunit|make money|profit|research|analy[sz]e|evaluate|find me|hunt|plan)\b/i.test(text);
  return decisionIntent || items.length >= 3;
}

export async function buildResponseIntelligence({
  base44,
  request,
  items,
  verificationSummary = '',
  personalFacts = [],
}: any) {
  if (!shouldUseResponseIntelligence(request, items)) return null;
  try {
    const evidence = (Array.isArray(items) ? items : []).slice(0, 12).map(compactItem).filter(Boolean);
    const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: 'gemini_3_flash',
      prompt: [
        'You are Buddy’s final decision-quality reviewer. The research is already done. Do NOT browse and do NOT invent new facts.',
        `User request: ${clean(request, 1800)}`,
        verificationSummary ? `Verification summary: ${clean(verificationSummary, 1000)}` : '',
        Array.isArray(personalFacts) && personalFacts.length ? `Relevant explicit/learned context (use only if it materially changes the recommendation): ${personalFacts.slice(0, 8).map((x: any) => clean(x, 180)).join(' | ')}` : '',
        `Normalized evidence: ${JSON.stringify(evidence).slice(0, 18000)}`,
        'Produce a decision-quality overlay using ONLY the evidence above.',
        'bottom_line: answer the user’s actual goal directly. Do not merely restate the findings. If multiple options exist and the evidence supports a clear winner, name it. If the evidence does not support a decision, say that plainly.',
        'best_next_move: one concrete action that most improves the user’s outcome or closes the most important evidence gap. Be specific.',
        'uncertainty: the single uncertainty most likely to change the decision. Leave empty when nothing material remains.',
        'confidence: high only when the key decision is supported by direct evidence; medium when evidence is useful but incomplete; low when the decision mainly depends on unresolved evidence.',
        'For arbitrage: verified opportunities outrank leads. Leads are NEVER buy recommendations and NEVER count as profit. If there are only leads, bottom_line must say there is no buy-ready deal yet and best_next_move should identify the strongest exact lead to finish verifying. Coupon-dependent deals must mention checkout verification when material.',
        'Do not claim certainty, urgency, profitability, availability, or personalization that the evidence does not support.',
        'Keep each field concise and practical. No motivational filler.',
      ].filter(Boolean).join('\n'),
      response_json_schema: RESPONSE_INTELLIGENCE_SCHEMA,
    });
    const result = {
      bottom_line: clean(response?.bottom_line, 320),
      best_next_move: clean(response?.best_next_move, 320),
      uncertainty: clean(response?.uncertainty, 260),
      confidence: ['high','medium','low'].includes(String(response?.confidence || '')) ? String(response.confidence) : 'medium',
    };
    if (!result.bottom_line || !result.best_next_move) return null;
    return result;
  } catch (_) {
    return null;
  }
}

export function responseIntelligenceLines(intelligence: any) {
  if (!intelligence) return [];
  const lines = [
    intelligence.bottom_line ? `Bottom line — ${intelligence.bottom_line}` : '',
    intelligence.best_next_move ? `Best next move — ${intelligence.best_next_move}` : '',
    intelligence.uncertainty ? `What could change this — ${intelligence.uncertainty}` : '',
  ].filter(Boolean);
  return lines;
}

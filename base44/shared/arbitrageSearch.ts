import { extractArbitrageProfitTarget } from './arbitrage.ts';

const RETAILERS = [
  ['target', 'Target'],
  ["ollie", "Ollie's"],
  ['kroger', 'Kroger'],
  ['meijer', 'Meijer'],
  ['tj maxx', 'TJ Maxx'],
  ['tjmaxx', 'TJ Maxx'],
  ['walmart', 'Walmart'],
  ['best buy', 'Best Buy'],
  ['home depot', 'Home Depot'],
  ["lowe", "Lowe's"],
  ['walgreens', 'Walgreens'],
  ['cvs', 'CVS'],
  ['costco', 'Costco'],
  ["sam's", "Sam's Club"],
  ['marshalls', 'Marshalls'],
  ['ross', 'Ross'],
];

const DEFAULT_RETAILERS = ['Target', 'Walmart', 'Best Buy', 'Home Depot', "Lowe's", 'Walgreens'];

const DISCOVERY_FOCUSES = [
  'HIGH-VALUE EXACT-SKU: LEGO and sealed toys/collectibles, video games/consoles/accessories, consumer electronics, power tools/tools, vacuums/small appliances, premium kitchen appliances, and branded beauty devices. Prefer recognizable brands and items typically priced/resold above $35.',
  'DEEP-DISCOUNT: current clearance/coupon/markdown items with an unusually large percentage or dollar discount and a direct product page. Prefer shippable branded goods. Deprioritize groceries, commodity consumables, low-dollar household basics, bulky furniture, and generic apparel unless the exact variant has an obvious high-value resale case.'
];

const CANDIDATE_SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item_name: { type: 'string' },
          retailer: { type: 'string' },
          category: { type: 'string' },
          brand: { type: 'string' },
          identifier: { type: 'string' },
          variant: { type: 'string' },
          original_price: { type: 'number' },
          buy_price: { type: 'number' },
          price_status: { type: 'string' },
          discount_amount: { type: 'number' },
          discount_description: { type: 'string' },
          discounts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                kind: { type: 'string' }, description: { type: 'string' }, effective_amount: { type: 'number' },
                source_url: { type: 'string' }, code: { type: 'string' }, eligibility: { type: 'string' },
                stackable_with_current_price: { type: 'boolean' }, applies_to_exact_item: { type: 'boolean' }, expires_at: { type: 'string' }
              }
            }
          },
          buy_url: { type: 'string' },
          availability_note: { type: 'string' },
          evidence_note: { type: 'string' },
        },
        required: ['item_name','retailer','buy_price','buy_url'],
      },
    },
  },
  required: ['candidates'],
};

const MATCH_SCHEMA = {
  type: 'object',
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item_name: { type: 'string' },
          retailer: { type: 'string' },
          category: { type: 'string' },
          brand: { type: 'string' },
          identifier: { type: 'string' },
          original_price: { type: 'number' },
          buy_price: { type: 'number' },
          price_status: { type: 'string' },
          discount_amount: { type: 'number' },
          discount_description: { type: 'string' },
          discounts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                kind: { type: 'string' }, description: { type: 'string' }, effective_amount: { type: 'number' },
                source_url: { type: 'string' }, code: { type: 'string' }, eligibility: { type: 'string' },
                stackable_with_current_price: { type: 'boolean' }, applies_to_exact_item: { type: 'boolean' }, expires_at: { type: 'string' }
              }
            }
          },
          buy_url: { type: 'string' },
          marketplace: { type: 'string' },
          resale_price: { type: 'number' },
          estimated_fees: { type: 'number' },
          resale_url: { type: 'string' },
          match_confidence: { type: 'number' },
          demand_note: { type: 'string' },
          caveat: { type: 'string' },
          missing_evidence: { type: 'string' },
          availability_note: { type: 'string' },
        },
        required: ['item_name','retailer','buy_price','buy_url'],
      },
    },
  },
  required: ['matches'],
};

function cleanText(v: unknown, n = 200) { return String(v || '').trim().slice(0, n); }
function cleanUrl(v: unknown) {
  const value = String(v || '').trim();
  if (!/^https?:\/\//i.test(value)) return '';
  try { return new URL(value).toString().slice(0, 800); } catch (_) { return ''; }
}

function isGenericEvidenceUrl(value: string) {
  try {
    const url = new URL(value);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (path === '/') return true;
    return /\/(?:current[-_]?flyer|weekly[-_]?ad|weekly[-_]?ads|circular|deals?|sales?|clearance|search|shop|products?|category|categories)$/i.test(path);
  } catch (_) { return true; }
}

export function namedArbitrageRetailers(text: unknown) {
  const lower = String(text || '').toLowerCase();
  const found: string[] = [];
  for (const [needle, label] of RETAILERS) {
    if (lower.includes(needle) && !found.includes(label)) found.push(label);
  }
  return found;
}

function chooseRetailers(text: string) {
  const named = namedArbitrageRetailers(text);
  return (named.length ? named : DEFAULT_RETAILERS).slice(0, 6);
}

async function discoverAtRetailer(base44: any, retailer: string, request: string, locationFacts: string[], focus: string) {
  const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
    model: 'gemini_3_flash',
    add_context_from_internet: true,
    prompt: [
      `Find up to 8 CURRENT specific arbitrage sourcing candidates at ${retailer}.`,
      `Overall request: ${request}`,
      `Discovery focus for this pass: ${focus}`,
      locationFacts.length ? `Relevant location/context: ${locationFacts.join(' | ')}` : '',
      'Use exact product/detail pages as evidence. Do not use the retailer homepage, generic search page, flyer, clearance hub, or category page as a candidate URL.',
      'For a large weekly profit target, prioritize meaningful per-unit economics. Prefer items that plausibly could produce at least about $20 profit per unit after marketplace fees or have enough price spread to justify verification. This is only a discovery heuristic, not a claimed profit fact.',
      'Do not waste the candidate budget on ordinary groceries, low-dollar consumables, or tiny discounts unless the evidence shows an exceptional resale case.',
      'Return category and brand when visible. Preserve exact UPC, SKU, model number, size/count, color, edition, or variant whenever visible. Variant matching matters more than candidate quantity.',
      'buy_price must be the current visible price on the exact page. Include a discount only when the page/source actually supports it. Never invent local inventory.',
      'If you cannot find a direct product/detail page with a current price, omit that candidate.',
    ].filter(Boolean).join('\n'),
    response_json_schema: CANDIDATE_SCHEMA,
  });
  return (Array.isArray(response?.candidates) ? response.candidates : []).map((c: any) => ({ ...c, retailer }));
}

export function candidateDiscoveryScore(c: any) {
  const buyPrice = Math.max(0, Number(c?.buy_price) || 0);
  const discount = Math.max(0, Number(c?.discount_amount) || 0);
  const identifierBonus = cleanText(c?.identifier, 100) ? 20 : 0;
  const brandBonus = cleanText(c?.brand, 80) ? 8 : 0;
  const priorityText = `${c?.category || ''} ${c?.brand || ''} ${c?.item_name || ''}`.toLowerCase();
  const priorityBonus = /lego|collectible|video game|console|electronics?|power tool|tool|vacuum|appliance|kitchen|beauty device/.test(priorityText) ? 25 : 0;
  const valueScore = Math.min(20, (buyPrice / 150) * 20);
  const discountScore = Math.min(27, discount > 0 && buyPrice > 0 ? (discount / (buyPrice + discount)) * 100 : 0);
  return identifierBonus + brandBonus + priorityBonus + valueScore + discountScore;
}

function dedupeCandidates(raw: any[]) {
  const out: any[] = [];
  const seen = new Set<string>();
  for (const c of raw) {
    const itemName = cleanText(c?.item_name, 120);
    const retailer = cleanText(c?.retailer, 60);
    const identifier = cleanText(c?.identifier, 100);
    const buyUrl = cleanUrl(c?.buy_url);
    const buyPrice = Number(c?.buy_price) || 0;
    if (!itemName || !retailer || !buyUrl || buyPrice <= 0 || isGenericEvidenceUrl(buyUrl)) continue;
    const key = `${retailer.toLowerCase()}|${identifier || itemName.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      item_name: itemName,
      retailer,
      category: cleanText(c?.category, 80),
      brand: cleanText(c?.brand, 80),
      identifier,
      variant: cleanText(c?.variant, 120),
      buy_price: Math.round(buyPrice * 100) / 100,
      discount_amount: Math.max(0, Number(c?.discount_amount) || 0),
      discount_description: cleanText(c?.discount_description, 180),
      buy_url: buyUrl,
      availability_note: cleanText(c?.availability_note, 180),
      evidence_note: cleanText(c?.evidence_note, 180),
    });
  }
  // Prevent the first retailer in the fan-out from consuming the whole match
  // budget. Keep the strongest candidates per retailer, then rank the balanced
  // pool globally. With six retailers this yields at most 36 products.
  const byRetailer = new Map<string, any[]>();
  for (const candidate of out) {
    const key = String(candidate.retailer || '').toLowerCase();
    if (!byRetailer.has(key)) byRetailer.set(key, []);
    byRetailer.get(key)!.push(candidate);
  }
  const balanced = [...byRetailer.values()].flatMap((group) =>
    group.sort((a, b) => candidateDiscoveryScore(b) - candidateDiscoveryScore(a)).slice(0, 6)
  );
  return balanced.sort((a, b) => candidateDiscoveryScore(b) - candidateDiscoveryScore(a)).slice(0, 36);
}

function matchKey(value: any) {
  const retailer = cleanText(value?.retailer, 60).toLowerCase();
  const identifier = cleanText(value?.identifier, 100).toLowerCase();
  const item = cleanText(value?.item_name, 120).toLowerCase().replace(/\s+/g, ' ');
  return `${retailer}|${identifier || item}`;
}

async function crossMatchBatch(base44: any, candidates: any[], request: string) {
  if (!candidates.length) return [];
  const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
    model: 'gemini_3_flash',
    add_context_from_internet: true,
    prompt: [
      'Cross-match these exact retail products against CURRENT Amazon and/or eBay resale evidence.',
      `Overall request: ${request}`,
      'Candidates:',
      JSON.stringify(candidates).slice(0, 16000),
      'For each candidate, search using identifier first (UPC/SKU/model) and then exact product+variant. Do not match a different size, count, color, edition, condition, bundle, or model.',
      'Prefer a direct Amazon product page, direct eBay listing/product page, or a highly specific eBay result page that clearly supports the quoted resale price. Never use Amazon/eBay homepages.',
      'resale_price must be supported by the returned resale_url. estimated_fees may be a conservative estimate; label uncertainty in caveat. Do not fabricate sold-through, stock quantity, or sales velocity.',
      'If visible evidence of resale demand exists (sold count, recent sold listing, review count, or active-listing depth), summarize only that visible evidence in demand_note. Otherwise leave demand_note empty.',
      'If you cannot verify resale evidence for the exact item, keep the retail side and set missing_evidence rather than inventing a match.',
    ].join('\n'),
    response_json_schema: MATCH_SCHEMA,
  });
  const returned = Array.isArray(response?.matches) ? response.matches : [];
  const byKey = new Map(returned.map((match: any) => [matchKey(match), match]));
  // Never silently lose an exact retail product because the resale search could
  // not finish. Missing matches become explicit one-sided leads for the next run.
  return candidates.map((candidate: any) => {
    const matched = byKey.get(matchKey(candidate));
    if (matched) return {
      ...candidate,
      ...matched,
      category: matched.category || candidate.category || '',
      brand: matched.brand || candidate.brand || '',
      identifier: matched.identifier || candidate.identifier || '',
      buy_url: matched.buy_url || candidate.buy_url,
      buy_price: Number(matched.buy_price) > 0 ? matched.buy_price : candidate.buy_price,
    };
    return {
      ...candidate,
      marketplace: 'Amazon/eBay',
      resale_price: 0,
      estimated_fees: 0,
      resale_url: '',
      match_confidence: 0.45,
      missing_evidence: 'Exact Amazon/eBay resale evidence did not clear this pass; Buddy will retry the SKU.',
      caveat: 'Retail buy side is preserved; no profit is counted until resale evidence clears.',
    };
  });
}

export function toFinding(match: any, target: number) {
  const itemName = cleanText(match?.item_name, 120);
  const retailer = cleanText(match?.retailer, 60);
  const identifier = cleanText(match?.identifier, 100);
  const category = cleanText(match?.category, 80);
  const brand = cleanText(match?.brand, 80);
  const buyPrice = Number(match?.buy_price) || 0;
  const discountAmount = Math.max(0, Number(match?.discount_amount) || 0);
  const netBuy = Math.max(0, buyPrice - discountAmount);
  const buyUrl = cleanUrl(match?.buy_url);
  const marketplace = cleanText(match?.marketplace, 60);
  const resalePrice = Number(match?.resale_price) || 0;
  const estimatedFees = Math.max(0, Number(match?.estimated_fees) || 0);
  const resaleUrl = cleanUrl(match?.resale_url);
  const profit = Math.round((resalePrice - netBuy - estimatedFees) * 100) / 100;
  const genericBuy = !buyUrl || isGenericEvidenceUrl(buyUrl);
  const genericResale = !resaleUrl || isGenericEvidenceUrl(resaleUrl);

  if (itemName && retailer && netBuy > 0 && resalePrice > 0 && profit > 0 && !genericBuy && !genericResale && marketplace) {
    const units = target > 0 ? Math.max(1, Math.ceil(target / profit)) : 0;
    const roi = netBuy > 0 ? (profit / netBuy) * 100 : 0;
    const matchConfidence = Math.min(1, Math.max(0, Number(match?.match_confidence) || 0.65));
    const unitScore = units > 0 ? (units <= 25 ? 15 : units <= 50 ? 12 : units <= 100 ? 8 : units <= 200 ? 4 : 0) : 6;
    const profitScore = Math.min(35, (profit / 60) * 35);
    const roiScore = Math.min(25, (roi / 80) * 25);
    const evidenceScore = matchConfidence * 20;
    const priorityText = `${category} ${brand} ${itemName}`.toLowerCase();
    const priorityBonus = /lego|collectible|video game|console|electronics?|power tool|tool|vacuum|appliance|kitchen|beauty device/.test(priorityText) ? 5 : 0;
    const actionabilityScore = Math.round(Math.min(100, profitScore + roiScore + evidenceScore + unitScore + priorityBonus));
    const actionTier = actionabilityScore >= 70 && profit >= 20 && roi >= 25 && matchConfidence >= 0.7 ? 'check_now' : actionabilityScore >= 50 ? 'promising' : 'low_priority';
    return {
      text: `${itemName}: est. $${profit.toFixed(2)} profit/unit · ${actionabilityScore}/100 actionability${units ? ` · ${units} units ≈ $${target.toLocaleString()}` : ''}`,
      source_name: retailer,
      url: buyUrl,
      arbitrage: {
        item_name: itemName,
        retailer,
        marketplace,
        category,
        brand,
        actionability_score: actionabilityScore,
        action_tier: actionTier,
        units_to_target: units,
        match_confidence: matchConfidence,
        demand_note: cleanText(match?.demand_note, 220),
        buy_price: buyPrice,
        discount_amount: discountAmount,
        discount_description: cleanText(match?.discount_description, 180),
        net_buy_cost: netBuy,
        resale_price: resalePrice,
        estimated_fees: estimatedFees,
        estimated_profit: profit,
        roi_percent: Math.round(roi * 10) / 10,
        buy_url: buyUrl,
        resale_url: resaleUrl,
        caveat: [
          cleanText(match?.caveat, 220),
          cleanText(match?.availability_note, 160),
          units ? `${units} units is only target math; inventory quantity and sell-through are not verified.` : '',
        ].filter(Boolean).join(' '),
      },
    };
  }

  const hasBuySide = itemName && retailer && buyPrice > 0 && !genericBuy;
  const hasResaleSide = itemName && resalePrice > 0 && !genericResale;
  if (hasBuySide !== hasResaleSide) {
    return {
      text: `${itemName}: promising lead; ${hasBuySide ? 'resale side' : 'buy side'} still needs verification`,
      source_name: retailer || marketplace,
      url: hasBuySide ? buyUrl : resaleUrl,
      arbitrage_lead: {
        item_name: itemName,
        retailer,
        marketplace,
        category,
        brand,
        identifier,
        buy_price: hasBuySide ? buyPrice : 0,
        resale_price: hasResaleSide ? resalePrice : 0,
        buy_url: hasBuySide ? buyUrl : '',
        resale_url: hasResaleSide ? resaleUrl : '',
        missing_evidence: cleanText(match?.missing_evidence, 180) || (hasBuySide ? 'Exact Amazon/eBay resale evidence still needs verification.' : 'Exact retailer buy-side evidence still needs verification.'),
        reason: 'Exact product identified with one side of the spread supported by a direct page.',
        confidence: Math.min(1, Math.max(0, Number(match?.match_confidence) || 0.6)),
      },
    };
  }
  return null;
}

export async function runRetailArbitragePipeline({ base44, buddy, personalFacts = [] }: any) {
  const request = `${buddy?.note || ''} ${buddy?.what_line || ''}`.trim();
  const target = extractArbitrageProfitTarget(request);
  const retailers = chooseRetailers(request);

  const priorLeads = Array.isArray(buddy?.arbitrage_leads) ? buddy.arbitrage_leads.slice(0, 10) : [];
  const priorAsCandidates = priorLeads
    .filter((lead: any) => Number(lead?.buy_price) > 0 && cleanUrl(lead?.buy_url))
    .map((lead: any) => ({
      item_name: lead.item_name,
      retailer: lead.retailer,
      category: lead.category || '',
      brand: lead.brand || '',
      identifier: lead.identifier,
      variant: '',
      buy_price: lead.buy_price,
      discount_amount: 0,
      discount_description: '',
      buy_url: lead.buy_url,
      availability_note: '',
      evidence_note: 'Carried forward from a recent unresolved Buddy lead.',
    }));

  const discoveryJobs = retailers.flatMap((retailer) =>
    DISCOVERY_FOCUSES.map((focus) => discoverAtRetailer(base44, retailer, request, personalFacts.slice(0, 8), focus))
  );
  const discoveredSettled = await Promise.allSettled(discoveryJobs);
  const discovered = discoveredSettled.flatMap((r) => r.status === 'fulfilled' ? r.value : []);
  const candidates = dedupeCandidates([...priorAsCandidates, ...discovered]);
  if (!candidates.length) return { findings: [], should_notify: false, verification_summary: 'No exact priced product pages were discovered in this pass.' };

  const batches: any[][] = [];
  for (let i = 0; i < candidates.length; i += 8) batches.push(candidates.slice(i, i + 8));
  const matchedSettled = await Promise.allSettled(batches.slice(0, 5).map((batch) => crossMatchBatch(base44, batch, request)));
  const matches = matchedSettled.flatMap((r) => r.status === 'fulfilled' ? r.value : []);

  const findings = matches.map((m) => toFinding(m, target)).filter(Boolean);
  const verified = findings.filter((f: any) => f.arbitrage)
    .sort((a: any, b: any) => {
      const sa = Number(a.arbitrage?.actionability_score || 0);
      const sb = Number(b.arbitrage?.actionability_score || 0);
      if (sb !== sa) return sb - sa;
      const pa = Number(a.arbitrage?.resale_price || 0) - Number(a.arbitrage?.net_buy_cost || 0) - Number(a.arbitrage?.estimated_fees || 0);
      const pb = Number(b.arbitrage?.resale_price || 0) - Number(b.arbitrage?.net_buy_cost || 0) - Number(b.arbitrage?.estimated_fees || 0);
      return pb - pa;
    });
  const leads = findings.filter((f: any) => f.arbitrage_lead)
    .sort((a: any, b: any) => Number(b.arbitrage_lead?.confidence || 0) - Number(a.arbitrage_lead?.confidence || 0));
  const strongVerified = verified.filter((f: any) => f.arbitrage?.action_tier !== 'low_priority');
  const lowPriorityVerified = verified.filter((f: any) => f.arbitrage?.action_tier === 'low_priority');
  const selectedVerified = [...strongVerified.slice(0, 8), ...lowPriorityVerified.slice(0, Math.max(0, 8 - strongVerified.length))];

  return {
    findings: [...selectedVerified, ...leads.slice(0, Math.max(0, 12 - selectedVerified.length))],
    should_notify: strongVerified.length > 0,
    verification_summary: `Ran ${retailers.length * DISCOVERY_FOCUSES.length} target-aware discovery passes across ${retailers.length} retailers, preserved ${candidates.length} exact priced candidates, and cross-matched ${matches.length} candidates against resale evidence.`,
  };
}

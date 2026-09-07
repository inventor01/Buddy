import { sanitizeDiscountOffers, summarizeDiscountOffers } from './discounts.ts';

export function extractArbitrageProfitTarget(value: unknown) {
  const text = String(value || '').toLowerCase();
  const moneyNearGoal = text.match(/(?:profit|make|earn|goal|target|minimum|min|at least|for)\D{0,18}\$?\s*(\d+(?:\.\d+)?)\s*([km])?\b/i)
    || text.match(/\$\s*(\d+(?:\.\d+)?)\s*([km])?\b/i)
    || text.match(/\b(\d+(?:\.\d+)?)\s*([km])\b/i);
  if (!moneyNearGoal) return 0;
  const base = Number(moneyNearGoal[1]) || 0;
  const suffix = String(moneyNearGoal[2] || '').toLowerCase();
  const valueNumber = suffix === 'k' ? base * 1000 : suffix === 'm' ? base * 1000000 : base;
  return valueNumber >= 100 ? Math.round(valueNumber) : 0;
}

export function arbitragePortfolioSummary(items: any[], target = 0) {
  const opportunities = (Array.isArray(items) ? items : []).filter((item) => item?.arbitrage);
  const verifiedPotential = Math.round(opportunities.reduce((sum, item) => sum + Math.max(0, Number(item.arbitrage?.estimated_profit) || 0), 0) * 100) / 100;
  const goal = Math.max(0, Number(target) || 0);
  const gap = Math.max(0, Math.round((goal - verifiedPotential) * 100) / 100);
  const checkNow = opportunities.filter((item) => item.arbitrage?.action_tier === 'check_now').length;
  const promising = opportunities.filter((item) => item.arbitrage?.action_tier === 'promising').length;
  const lowPriority = opportunities.filter((item) => item.arbitrage?.action_tier === 'low_priority').length;
  return { verified_potential: verifiedPotential, target: goal, gap, count: opportunities.length, check_now: checkNow, promising, low_priority: lowPriority };
}

export function normalizeArbitrageLead(raw: any, sanitizeUrl: (value: unknown) => string) {
  if (!raw || typeof raw !== 'object') return null;
  const itemName = String(raw.item_name || '').trim().slice(0, 120);
  const retailer = String(raw.retailer || '').trim().slice(0, 60);
  const marketplace = String(raw.marketplace || '').trim().slice(0, 60);
  const category = String(raw.category || '').trim().slice(0, 80);
  const brand = String(raw.brand || '').trim().slice(0, 80);
  const identifier = String(raw.identifier || '').trim().slice(0, 100);
  const originalPrice = Math.max(0, Number(raw.original_price) || 0);
  const buyPrice = Math.max(0, Number(raw.buy_price) || 0);
  const verifiedDiscounts = sanitizeDiscountOffers(raw.discounts, buyPrice);
  const discount = summarizeDiscountOffers(verifiedDiscounts);
  const netBuyCost = Math.max(0, buyPrice - discount.total);
  const resalePrice = Math.max(0, Number(raw.resale_price) || 0);
  const buyUrl = sanitizeUrl(raw.buy_url);
  const resaleUrl = sanitizeUrl(raw.resale_url);
  const missingEvidence = String(raw.missing_evidence || '').trim().slice(0, 180);
  const reason = String(raw.reason || '').trim().slice(0, 240);
  const confidence = Math.min(1, Math.max(0, Number(raw.confidence) || 0));

  if (!itemName || (!buyUrl && !resaleUrl)) return null;
  if (buyUrl && isGenericArbitrageEvidenceUrl(buyUrl)) return null;
  if (resaleUrl && isGenericArbitrageEvidenceUrl(resaleUrl)) return null;
  const hasBuySide = buyPrice > 0 && !!buyUrl;
  const hasResaleSide = resalePrice > 0 && !!resaleUrl;
  if (!hasBuySide && !hasResaleSide) return null;
  // If both sides are present, this should graduate through the verified gate instead.
  if (hasBuySide && hasResaleSide) return null;

  return {
    item_name: itemName,
    retailer,
    marketplace,
    category,
    brand,
    identifier,
    original_price: Math.max(buyPrice, originalPrice),
    buy_price: Math.round(buyPrice * 100) / 100,
    price_status: String(raw.price_status || '').trim().slice(0, 30),
    discount_amount: discount.total,
    discount_description: discount.description,
    discounts: verifiedDiscounts,
    net_buy_cost: Math.round(netBuyCost * 100) / 100,
    resale_price: Math.round(resalePrice * 100) / 100,
    buy_url: buyUrl,
    resale_url: resaleUrl,
    missing_evidence: missingEvidence || (hasBuySide ? 'Exact resale evidence still needs verification.' : 'Exact buy-side price evidence still needs verification.'),
    reason,
    confidence,
  };
}

export function isGenericArbitrageEvidenceUrl(value: unknown) {
  try {
    const url = new URL(String(value || ''));
    const path = url.pathname.replace(/\/+$/, '');
    return /\/(?:current[-_]?flyer|weekly[-_]?ad|weekly[-_]?ads|circular|deals?|sales?|clearance)$/i.test(path);
  } catch (_) {
    return true;
  }
}

export function normalizeArbitrageCandidate(raw: any, sanitizeUrl: (value: unknown) => string) {
  if (!raw || typeof raw !== 'object') return null;
  const itemName = String(raw.item_name || '').trim().slice(0, 120);
  const retailer = String(raw.retailer || '').trim().slice(0, 60);
  const marketplace = String(raw.marketplace || '').trim().slice(0, 60);
  const category = String(raw.category || '').trim().slice(0, 80);
  const brand = String(raw.brand || '').trim().slice(0, 80);
  const originalPrice = Math.max(0, Number(raw.original_price) || 0);
  const buyPrice = Number(raw.buy_price) || 0;
  const verifiedDiscounts = sanitizeDiscountOffers(raw.discounts, buyPrice);
  const discount = summarizeDiscountOffers(verifiedDiscounts);
  const discountAmount = discount.total;
  const netBuyCost = buyPrice > 0 ? Math.max(0, buyPrice - discountAmount) : 0;
  const resalePrice = Number(raw.resale_price) || 0;
  const estimatedFees = Math.max(0, Number(raw.estimated_fees) || 0);
  const buyUrl = sanitizeUrl(raw.buy_url);
  const resaleUrl = sanitizeUrl(raw.resale_url);
  const profitWithoutExtraDiscounts = Math.round((resalePrice - buyPrice - estimatedFees) * 100) / 100;
  const estimatedProfit = Math.round((resalePrice - netBuyCost - estimatedFees) * 100) / 100;
  const couponDependent = estimatedProfit > 0 && profitWithoutExtraDiscounts <= 0 && discountAmount > 0;
  const roiPercent = netBuyCost > 0 ? Math.round((estimatedProfit / netBuyCost) * 1000) / 10 : 0;

  if (!itemName || !retailer || !marketplace || netBuyCost <= 0 || resalePrice <= 0 || estimatedProfit <= 0) return null;
  if (!buyUrl || !resaleUrl || isGenericArbitrageEvidenceUrl(buyUrl) || isGenericArbitrageEvidenceUrl(resaleUrl)) return null;

  const actionabilityScore = Math.min(100, Math.max(0, Math.round(Number(raw.actionability_score) || 0)));
  const actionTier = ['check_now','promising','low_priority'].includes(String(raw.action_tier || '')) ? String(raw.action_tier) : 'promising';
  const unitsToTarget = Math.max(0, Math.round(Number(raw.units_to_target) || 0));
  const matchConfidence = Math.min(1, Math.max(0, Number(raw.match_confidence) || 0));

  return {
    item_name: itemName,
    retailer,
    marketplace,
    category,
    brand,
    actionability_score: actionabilityScore,
    action_tier: actionTier,
    units_to_target: unitsToTarget,
    match_confidence: matchConfidence,
    demand_note: String(raw.demand_note || '').trim().slice(0, 220),
    original_price: Math.max(buyPrice, originalPrice),
    buy_price: Math.round(buyPrice * 100) / 100,
    price_status: String(raw.price_status || '').trim().slice(0, 30),
    discount_amount: Math.round(discountAmount * 100) / 100,
    discount_description: discount.description,
    discounts: verifiedDiscounts,
    coupon_dependent: couponDependent,
    profit_without_extra_discounts: profitWithoutExtraDiscounts,
    net_buy_cost: Math.round(netBuyCost * 100) / 100,
    resale_price: Math.round(resalePrice * 100) / 100,
    estimated_fees: Math.round(estimatedFees * 100) / 100,
    estimated_profit: estimatedProfit,
    roi_percent: roiPercent,
    buy_url: buyUrl,
    resale_url: resaleUrl,
    caveat: String(raw.caveat || '').trim().slice(0, 300),
  };
}

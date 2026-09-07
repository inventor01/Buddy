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
  return { verified_potential: verifiedPotential, target: goal, gap, count: opportunities.length };
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
  const buyPrice = Number(raw.buy_price) || 0;
  const discountAmount = Math.max(0, Number(raw.discount_amount) || 0);
  const statedNet = Number(raw.net_buy_cost) || 0;
  const netBuyCost = buyPrice > 0 ? Math.max(0, buyPrice - discountAmount) : statedNet;
  const resalePrice = Number(raw.resale_price) || 0;
  const estimatedFees = Math.max(0, Number(raw.estimated_fees) || 0);
  const buyUrl = sanitizeUrl(raw.buy_url);
  const resaleUrl = sanitizeUrl(raw.resale_url);
  const estimatedProfit = Math.round((resalePrice - netBuyCost - estimatedFees) * 100) / 100;
  const roiPercent = netBuyCost > 0 ? Math.round((estimatedProfit / netBuyCost) * 1000) / 10 : 0;

  if (!itemName || !retailer || !marketplace || netBuyCost <= 0 || resalePrice <= 0 || estimatedProfit <= 0) return null;
  if (!buyUrl || !resaleUrl || isGenericArbitrageEvidenceUrl(buyUrl) || isGenericArbitrageEvidenceUrl(resaleUrl)) return null;

  return {
    item_name: itemName,
    retailer,
    marketplace,
    buy_price: Math.round(buyPrice * 100) / 100,
    discount_amount: Math.round(discountAmount * 100) / 100,
    discount_description: String(raw.discount_description || '').trim().slice(0, 180),
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

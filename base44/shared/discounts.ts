export function cleanDiscountUrl(value: unknown) {
  const text = String(value || '').trim();
  if (!/^https?:\/\//i.test(text)) return '';
  try {
    const url = new URL(text);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (path === '/') return '';
    if (/\/(?:home|index(?:\.html?|\.php)?)$/i.test(path)) return '';
    return url.toString().slice(0, 800);
  } catch (_) {
    return '';
  }
}

export function sanitizeDiscountOffers(raw: any, buyPrice: number, nowMs = Date.now()) {
  const price = Math.max(0, Number(buyPrice) || 0);
  if (!price) return [];
  const accepted: any[] = [];
  const rejectedTerms = /personalized|targeted|account[- ]specific|select customers?|first[- ]time|new customers?|employee|credit card|cardholder|future reward|store cash|rebate|unknown/i;

  for (const d of Array.isArray(raw) ? raw.slice(0, 10) : []) {
    const amount = Math.max(0, Number(d?.effective_amount) || 0);
    const sourceUrl = cleanDiscountUrl(d?.source_url);
    const eligibility = String(d?.eligibility || '').trim().slice(0, 140);
    const description = String(d?.description || '').trim().slice(0, 180);
    const expiresAt = String(d?.expires_at || '').trim().slice(0, 40);
    const expiryMs = expiresAt ? Date.parse(expiresAt) : NaN;

    if (!amount || amount > price || !sourceUrl) continue;
    if (d?.applies_to_exact_item !== true || d?.stackable_with_current_price !== true) continue;
    if (rejectedTerms.test(`${eligibility} ${description}`)) continue;
    if (Number.isFinite(expiryMs) && expiryMs < nowMs) continue;

    accepted.push({
      kind: String(d?.kind || '').trim().slice(0, 50),
      description,
      effective_amount: Math.round(amount * 100) / 100,
      source_url: sourceUrl,
      code: String(d?.code || '').trim().slice(0, 50),
      eligibility,
      stackable_with_current_price: true,
      applies_to_exact_item: true,
      expires_at: expiresAt,
    });
  }

  // Bound the total so malformed/model-supplied offers can never reduce net cost
  // below zero. We intentionally do not infer stacking between discount offers;
  // each accepted offer must itself explicitly stack with the current price.
  let remaining = price;
  const bounded: any[] = [];
  for (const d of accepted) {
    const applied = Math.min(remaining, d.effective_amount);
    if (applied <= 0) continue;
    bounded.push({ ...d, effective_amount: Math.round(applied * 100) / 100 });
    remaining -= applied;
  }
  return bounded;
}

export function summarizeDiscountOffers(discounts: any[]) {
  const list = Array.isArray(discounts) ? discounts : [];
  const total = Math.round(list.reduce((sum, d) => sum + Math.max(0, Number(d?.effective_amount) || 0), 0) * 100) / 100;
  const description = list.map((d) => {
    const core = String(d?.description || d?.kind || '').trim();
    const label = d?.code ? `${core || 'Coupon'} (${String(d.code).trim()})` : core;
    return label ? `${label}: -$${Number(d?.effective_amount || 0).toFixed(2)}` : '';
  }).filter(Boolean).join(' + ').slice(0, 360);
  return { total, description };
}

// Central rules for deciding when Buddy should NOT ask an optional narrowing question.
// The user can intentionally ask for broad discovery. Breadth is a valid instruction,
// not a missing field that must be clarified away.

function normalized(value: unknown) {
  return String(value || '').toLowerCase();
}

export function isArbitrageRequest(value: unknown) {
  const text = normalized(value);
  const arbitrageIntent = /\b(arbitrage|arbritage|arbitage|resell(?:ing)?|resale|flip(?:ping)?|buy low|price spread|profit opportunities?)\b/.test(text);
  const discoveryIntent = /\b(find|search|scan|look for|hunt|identify|opportunit|deals?|profitable|margin)\b/.test(text);
  return arbitrageIntent && discoveryIntent;
}

export function isBroadArbitrageScan(value: unknown) {
  const text = normalized(value);
  if (!isArbitrageRequest(text)) return false;
  const retailerMatches = text.match(/\b(target|ollie'?s|kroger'?s|meijer'?s|tj\s*maxx|walmart|costco|sam'?s club|walgreens|cvs|home depot|lowe'?s|best buy|marshalls|ross|aldi)\b/g) || [];
  const broadLanguage = /\b(any|all|across|between|whatever|best opportunities?|top opportunities?|stores?|products?|this week|weekly|everyday|daily)\b/.test(text) || retailerMatches.length >= 2;
  const explicitlyNarrowed = /\b(only|specifically|just)\s+(?:in|for)?\s*(electronics?|toys?|beauty|cosmetics|grocery|groceries|clothing|apparel|shoes?|tools?|home goods?|video games?|collectibles?|books?)\b/.test(text);
  // If the user asks for arbitrage discovery without naming a category, treat that
  // as intentionally broad even when they did not spell out Amazon/eBay/stores.
  return !explicitlyNarrowed && (broadLanguage || !/\b(electronics?|toys?|beauty|cosmetics|grocery|groceries|clothing|apparel|shoes?|tools?|home goods?|video games?|collectibles?|books?)\b/.test(text));
}

export function isOptionalProductScopeQuestion(value: unknown) {
  const q = normalized(value);
  if (!q) return false;
  return /\b(product category|product categories|category|categories|specific items?|specific products?|which items?|what items?|which products?|what products?|types? of products?|kinds? of products?|which stores?|what stores?|which retailers?|what retailers?|which marketplaces?|what marketplaces?|amazon or ebay|ebay or amazon|focus on)\b/.test(q);
}

export function suppressOptionalClarification(requestText: unknown, question: unknown) {
  const q = String(question || '').trim().slice(0, 200);
  if (!q) return '';
  if (isBroadArbitrageScan(requestText) && isOptionalProductScopeQuestion(q)) return '';
  return q;
}

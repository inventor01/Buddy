function safeUrl(value: unknown) {
  try {
    const raw = String(value || '').trim();
    if (!/^https?:\/\//i.test(raw)) return null;
    return new URL(raw);
  } catch (_) {
    return null;
  }
}

const GENERIC_SEGMENTS = /\/(?:c|q|s|search|browse|category|categories|collections?|clearance|deals?|sales?|weekly[-_]?ad|current[-_]?flyer|shop|shopping\/dept)(?:\/|$)/i;

export function isExactRetailProductUrl(value: unknown, retailer?: unknown) {
  const url = safeUrl(value);
  if (!url) return false;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const retailerText = String(retailer || '').toLowerCase();

  // Explicit product-detail allow patterns for the retailers Buddy searches most.
  if (host.endsWith('target.com') || retailerText.includes('target')) {
    return /\/p\/.+\/-\/A-\d+/i.test(path);
  }
  if (host.endsWith('kroger.com') || retailerText.includes('kroger')) {
    return /\/p\/.+\/\d{10,14}$/i.test(path);
  }
  if (host.endsWith('meijer.com') || retailerText.includes('meijer')) {
    return /\/(?:shopping\/product|product)\/.+/i.test(path) && !/\/shopping\/dept\//i.test(path);
  }
  if (host.endsWith('tjmaxx.tjx.com') || retailerText.includes('tj maxx') || retailerText.includes('tjmaxx')) {
    return /\/store\/jump\/product\/.+/i.test(path);
  }
  if (host.endsWith('ollies.com') || retailerText.includes("ollie")) {
    return /\/(?:products?|collections\/products)\/.+/i.test(path) && !/\/(?:pages|collections)\/(?:current-flyer|deals?|sale|clearance)/i.test(path);
  }
  if (host.endsWith('walmart.com') || retailerText.includes('walmart')) return /\/ip\/.+/i.test(path);
  if (host.endsWith('bestbuy.com') || retailerText.includes('best buy')) return /\/site\/.+\/\d+\.p$/i.test(path);
  if (host.endsWith('homedepot.com') || retailerText.includes('home depot')) return /\/p\/.+/i.test(path);
  if (host.endsWith('lowes.com') || retailerText.includes("lowe")) return /\/pd\/.+/i.test(path);
  if (host.endsWith('walgreens.com') || retailerText.includes('walgreens')) return /\/store\/c\/.+/i.test(path);
  if (host.endsWith('cvs.com') || retailerText === 'cvs') return /\/shop\/.+(?:prodid|\/p\/)\S*/i.test(path + url.search);
  if (host.endsWith('costco.com') || retailerText.includes('costco')) return /\/.product\.\d+\.html$/i.test(path) || /\/p\/.+/i.test(path);

  // Unknown retailer fallback: reject obvious browse/search hubs. Allow a
  // non-generic deep link so new retailers do not require a code change first.
  if (path === '/' || GENERIC_SEGMENTS.test(path)) return false;
  if (/^(?:q|query|search|keyword|category|cat)$/i.test([...url.searchParams.keys()][0] || '')) return false;
  return path.split('/').filter(Boolean).length >= 2;
}

export function retailEvidenceReason(value: unknown, retailer?: unknown) {
  const url = safeUrl(value);
  if (!url) return 'Missing or invalid retailer URL.';
  if (isExactRetailProductUrl(url.toString(), retailer)) return '';
  const path = url.pathname;
  if (GENERIC_SEGMENTS.test(path) || path === '/') return 'This is a browse/search/category page, not an exact product-detail page.';
  return 'The URL does not match a verified product-detail route for this retailer.';
}

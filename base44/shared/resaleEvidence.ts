function safeUrl(value: unknown) {
  try {
    const raw = String(value || '').trim();
    if (!/^https?:\/\//i.test(raw)) return null;
    return new URL(raw);
  } catch (_) {
    return null;
  }
}

const GENERIC_RESALE_SEGMENTS = /\/(?:s|sch|search|browse|deals?|category|categories|best-sellers?|gp\/search)(?:\/|$)/i;

export function isExactResaleCompUrl(value: unknown, marketplace?: unknown) {
  const url = safeUrl(value);
  if (!url) return false;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const market = String(marketplace || '').toLowerCase();

  if (host.endsWith('amazon.com') || market.includes('amazon')) {
    // Exact Amazon product-detail pages. ASINs are 10 alphanumeric chars.
    if (/\/dp\/[A-Z0-9]{10}(?:\/|$)/i.test(path)) return true;
    if (/\/gp\/product\/[A-Z0-9]{10}(?:\/|$)/i.test(path)) return true;
    return false;
  }

  if (host.endsWith('ebay.com') || market.includes('ebay')) {
    // Exact eBay item/listing page. A search/results page is never a comp.
    if (/\/itm\/(?:[^/]+\/)?\d{9,15}(?:\/|$)/i.test(path)) return true;
    return false;
  }

  return false;
}

export function resaleEvidenceReason(value: unknown, marketplace?: unknown) {
  const url = safeUrl(value);
  if (!url) return 'Missing or invalid resale URL.';
  if (isExactResaleCompUrl(url.toString(), marketplace)) return '';
  const host = url.hostname.toLowerCase();
  const path = url.pathname || '/';
  if (host.includes('amazon.') && (GENERIC_RESALE_SEGMENTS.test(path) || url.searchParams.has('k'))) {
    return 'This is an Amazon search/browse page, not an exact product-detail comp.';
  }
  if (host.includes('ebay.') && (GENERIC_RESALE_SEGMENTS.test(path) || /\/sch\//i.test(path) || url.searchParams.has('_nkw'))) {
    return 'This is an eBay search/results page, not an exact item/listing comp.';
  }
  return 'The resale URL is not an exact Amazon product page or eBay item page.';
}

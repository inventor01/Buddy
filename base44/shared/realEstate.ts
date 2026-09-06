import { secrets } from 'base44:runtime';

const DEFAULTS = {
  investor_arv_percent: 0.7,
  assignment_fee: 10000,
  repair_per_sqft: 25,
  comp_radius_miles: 1,
  comp_days_old: 180,
  min_discount_percent: 15,
  max_candidates_to_underwrite: 10,
  property_types: ['Single Family', 'Multi-Family'],
};

export function isWholesalePropertyRequest(text: string) {
  const s = String(text || '').toLowerCase();
  const property = /\b(property|properties|house|houses|home|homes|real estate|listing|listings)\b/.test(s);
  const wholesale = /\b(wholesale|wholesaling|distressed|arv|after repair value|flipper|under contract|assignment fee|below market)\b/.test(s);
  return property && wholesale;
}

export function extractZip(text: string) {
  const m = String(text || '').match(/\b(\d{5})(?:-\d{4})?\b/);
  return m?.[1] || '';
}

function number(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function historyStats(history: any, currentPrice: number) {
  const entries = history && typeof history === 'object' ? Object.values(history) as any[] : [];
  const prices = entries.map((h) => number(h?.price)).filter((n) => n > 0);
  const highest = prices.length ? Math.max(...prices) : currentPrice;
  const unique = [...new Set(prices)];
  return {
    priceCuts: Math.max(0, unique.length - 1),
    highestPrice: highest,
    cutPercent: highest > 0 && currentPrice > 0 ? ((highest - currentPrice) / highest) * 100 : 0,
  };
}

function preliminaryDistressScore(listing: any) {
  const price = number(listing?.price);
  const dom = number(listing?.daysOnMarket);
  const stats = historyStats(listing?.history, price);
  const type = String(listing?.listingType || '').toLowerCase();
  let score = 0;
  if (type === 'foreclosure') score += 35;
  else if (type === 'short sale') score += 30;
  score += clamp(dom / 4, 0, 25);
  score += clamp(stats.priceCuts * 6, 0, 18);
  score += clamp(stats.cutPercent, 0, 20);
  if (price > 0 && price < 100000) score += 5;
  return score;
}

async function rentcast(path: string, params: Record<string, any>) {
  const key = secrets.get('RENTCAST_API_KEY');
  if (!key) {
    const err: any = new Error('Property underwriting is ready, but live property data is not connected yet. Add a RentCast API key to enable ARV and comp-backed deal analysis.');
    err.code = 'REAL_ESTATE_DATA_NOT_CONFIGURED';
    throw err;
  }
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && String(v) !== '') qs.set(k, String(v));
  const r = await fetch(`https://api.rentcast.io/v1${path}?${qs.toString()}`, { headers: { 'X-Api-Key': key, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`Property data provider returned ${r.status}.`);
  return await r.json();
}

async function loadWholesaleProfile(base44: any, ownerId: string, note: string) {
  let p: any = null;
  try {
    const rows = await base44.asServiceRole.entities.WholesaleProfile.filter({ owner_id: ownerId }, '-updated_date', 1);
    p = Array.isArray(rows) ? rows[0] || null : null;
  } catch (_) {}
  const zip = extractZip(note) || String(p?.default_zip || '').trim();
  return {
    ...DEFAULTS,
    ...(p || {}),
    default_zip: zip,
    investor_arv_percent: clamp(number(p?.investor_arv_percent, DEFAULTS.investor_arv_percent), 0.4, 0.9),
    assignment_fee: clamp(number(p?.assignment_fee, DEFAULTS.assignment_fee), 0, 100000),
    repair_per_sqft: clamp(number(p?.repair_per_sqft, DEFAULTS.repair_per_sqft), 0, 250),
    comp_radius_miles: clamp(number(p?.comp_radius_miles, DEFAULTS.comp_radius_miles), 0.1, 5),
    comp_days_old: Math.round(clamp(number(p?.comp_days_old, DEFAULTS.comp_days_old), 30, 730)),
    min_discount_percent: clamp(number(p?.min_discount_percent, DEFAULTS.min_discount_percent), 0, 60),
    max_candidates_to_underwrite: Math.round(clamp(number(p?.max_candidates_to_underwrite, DEFAULTS.max_candidates_to_underwrite), 3, 15)),
    property_types: Array.isArray(p?.property_types) && p.property_types.length ? p.property_types : DEFAULTS.property_types,
  };
}

async function findListingPage(base44: any, address: string) {
  try {
    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: 'gemini_3_flash',
      add_context_from_internet: true,
      prompt: [
        `Find the current property listing page for this exact address: ${address}`,
        'Prefer Zillow, then Redfin, then Realtor.com. Return only a URL you actually found for this exact property; never invent a path.',
        'Also return the source name. If none can be verified, leave both empty.'
      ].join('\n'),
      response_json_schema: {
        type: 'object',
        properties: { url: { type: 'string' }, source: { type: 'string' } },
        required: ['url', 'source']
      }
    });
    let url = typeof res?.url === 'string' ? res.url.trim() : '';
    if (url && !/^https?:\/\//i.test(url)) url = '';
    if (url) {
      try { new URL(url); } catch (_) { url = ''; }
    }
    return { url, source: url ? String(res?.source || '').slice(0, 50) : '' };
  } catch (_) {
    return { url: '', source: '' };
  }
}

export async function runWholesaleDealFinder({ base44, buddy }: { base44: any, buddy: any }) {
  const settings = await loadWholesaleProfile(base44, buddy.owner_id, buddy.note || buddy.what_line || '');
  const zip = settings.default_zip;
  if (!zip) return { needs_context: 'What ZIP code should Buddy search for wholesale deals?', should_notify: true, findings: [] };

  const all: any[] = [];
  for (const propertyType of settings.property_types.slice(0, 4)) {
    const rows = await rentcast('/listings/sale', { zipCode: zip, status: 'Active', propertyType, limit: 40 });
    if (Array.isArray(rows)) all.push(...rows);
  }
  const deduped = [...new Map(all.map((x) => [x?.id || x?.formattedAddress, x])).values()]
    .filter((x: any) => number(x?.price) > 0 && x?.formattedAddress)
    .sort((a: any, b: any) => preliminaryDistressScore(b) - preliminaryDistressScore(a));

  const candidates = deduped.slice(0, settings.max_candidates_to_underwrite);
  const underwritten: any[] = [];

  for (const listing of candidates) {
    try {
      const avm = await rentcast('/avm/value', {
        address: listing.formattedAddress,
        propertyType: listing.propertyType || undefined,
        bedrooms: listing.bedrooms ?? undefined,
        bathrooms: listing.bathrooms ?? undefined,
        squareFootage: listing.squareFootage ?? undefined,
        maxRadius: settings.comp_radius_miles,
        daysOld: settings.comp_days_old,
        compCount: 8,
        lookupSubjectAttributes: true,
      });
      const arv = number(avm?.price);
      const listPrice = number(listing.price);
      if (!arv || !listPrice) continue;
      const sqft = number(listing.squareFootage);
      const repairAllowance = sqft > 0 ? Math.round(sqft * settings.repair_per_sqft) : 0;
      const flipperMax = Math.round(arv * settings.investor_arv_percent - repairAllowance);
      const maxContract = Math.round(flipperMax - settings.assignment_fee);
      const discountPct = ((arv - listPrice) / arv) * 100;
      const marginAtList = flipperMax - listPrice;
      const stats = historyStats(listing.history, listPrice);
      const type = String(listing.listingType || 'Standard');
      let dealScore = 25;
      dealScore += clamp(discountPct, 0, 35);
      dealScore += clamp(number(listing.daysOnMarket) / 5, 0, 15);
      dealScore += clamp(stats.priceCuts * 5, 0, 10);
      if (/foreclosure/i.test(type)) dealScore += 15;
      if (/short sale/i.test(type)) dealScore += 12;
      if (maxContract >= listPrice) dealScore += 15;
      dealScore = Math.round(clamp(dealScore, 0, 100));

      const comps = Array.isArray(avm?.comparables) ? avm.comparables.slice(0, 5).map((c: any) => ({
        address: String(c?.formattedAddress || c?.address || '').slice(0, 120),
        price: number(c?.price),
        distance: number(c?.distance),
        correlation: number(c?.correlation),
      })).filter((c: any) => c.address && c.price) : [];

      underwritten.push({
        listing,
        arv,
        arvLow: number(avm?.priceRangeLow),
        arvHigh: number(avm?.priceRangeHigh),
        listPrice,
        repairAllowance,
        flipperMax,
        maxContract,
        assignmentFee: settings.assignment_fee,
        investorPct: settings.investor_arv_percent,
        repairPerSqft: settings.repair_per_sqft,
        discountPct,
        marginAtList,
        dealScore,
        stats,
        comps,
      });
    } catch (_) {}
  }

  underwritten.sort((a, b) => b.dealScore - a.dealScore || b.marginAtList - a.marginAtList);
  const viable = underwritten.filter((d) => d.discountPct >= settings.min_discount_percent || d.maxContract >= d.listPrice).slice(0, 5);
  const chosen = viable.length ? viable : underwritten.slice(0, 3);

  const findings = [];
  for (const d of chosen) {
    const page = await findListingPage(base44, d.listing.formattedAddress);
    const attractive = d.maxContract >= d.listPrice;
    const text = attractive
      ? `${d.listing.addressLine1 || d.listing.formattedAddress}: ${Math.round(d.discountPct)}% below ARV; max contract ~$${d.maxContract.toLocaleString()}.`
      : `${d.listing.addressLine1 || d.listing.formattedAddress}: interesting lead, but list price is above the modeled max contract.`;
    findings.push({
      text,
      source_name: page.source || 'RentCast',
      url: page.url || '',
      why_fit: `ZIP ${zip}; deal score ${d.dealScore}/100`,
      deal: {
        address: d.listing.formattedAddress,
        zip_code: zip,
        property_type: d.listing.propertyType || '',
        list_price: d.listPrice,
        arv: d.arv,
        arv_low: d.arvLow,
        arv_high: d.arvHigh,
        repairs: d.repairAllowance,
        repair_basis: d.repairPerSqft > 0 && number(d.listing.squareFootage) > 0 ? `$${d.repairPerSqft}/sq ft screening allowance` : 'No repair allowance available',
        flipper_max: d.flipperMax,
        max_contract: d.maxContract,
        assignment_fee: d.assignmentFee,
        investor_arv_percent: d.investorPct,
        deal_score: d.dealScore,
        days_on_market: number(d.listing.daysOnMarket),
        price_cuts: d.stats.priceCuts,
        listing_type: d.listing.listingType || '',
        square_footage: number(d.listing.squareFootage),
        bedrooms: number(d.listing.bedrooms),
        bathrooms: number(d.listing.bathrooms),
        listing_url: page.url || '',
        listing_source: page.source || '',
        image_url: '',
        comps: d.comps,
        caveat: 'Screening estimate only. Verify condition, title, taxes, liens, comps, repair scope, and local wholesaling requirements before making an offer.',
      }
    });
  }

  if (!findings.length) {
    return {
      findings: [{ text: `No property in ${zip} cleared the current wholesale screen today.`, source_name: 'RentCast', url: '' }],
      needs_context: '',
      should_notify: false,
    };
  }
  return { findings, needs_context: '', should_notify: true };
}

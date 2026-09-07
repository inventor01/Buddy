// Runs one buddy: searches the web for today's findings, pins them back on
// the buddy's lantern, and delivers them by email and/or text message.
// Every finding carries proof of work — the site it came from and the
// exact URL it was read at. Shared by the hourly scheduler, the "Run now"
// button, and the visitor preview.

import { secrets } from "base44:runtime";
import { parseDelivery } from "./plan.ts";
import { runAdsBuddy } from "./ads.ts";
import { runSocialBuddy } from "./social.ts";
import { isWholesalePropertyRequest, runWholesaleDealFinder } from "./realEstate.ts";
import { runOrchestratedBuddy, shouldOrchestrateRequest } from "./orchestrator.ts";
import { loadLinkedBuddies, linkedBuddyPromptLines } from "./linkedBuddies.ts";
import { taskStepPromptLines } from "./taskChain.ts";
import { isBroadArbitrageScan, suppressOptionalClarification } from "./clarification.ts";
import { arbitragePortfolioSummary, extractArbitrageProfitTarget, normalizeArbitrageCandidate, normalizeArbitrageLead } from "./arbitrage.ts";
import { runRetailArbitragePipeline } from "./arbitrageSearch.ts";

// The clock where the person actually is. A note set for 9 in the morning
// should run at their 9, and "already ran today" means their today — so both
// the hour and the calendar date come from their zone, not the server's.
export function nowInZone(timeZone) {
  const read = (tz) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      weekday: "long"
    }).formatToParts(new Date());

  let parts;
  try {
    parts = read(typeof timeZone === "string" && timeZone ? timeZone : "UTC");
  } catch (_) {
    // An unknown zone should never stop the sweep — fall back to UTC.
    parts = read("UTC");
  }
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  const hour = parseInt(get("hour"), 10);
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: get("weekday").toLowerCase(),
    // some runtimes render midnight as 24
    hour: Number.isNaN(hour) ? 0 : hour % 24
  };
}

export function scheduleMatchesToday(whenLine, timeZone) {
  const when = typeof whenLine === "string" ? whenLine.toLowerCase() : "";
  const namedDays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const requestedDays = namedDays.filter((day) => when.includes(day));
  if (!requestedDays.length) return true;
  return requestedDays.includes(nowInZone(timeZone).weekday);
}

export function parseScheduleHour(scheduleTime) {
  const m = typeof scheduleTime === "string" ? scheduleTime.match(/(\d{1,2})/) : null;
  if (!m) return 9; // sensible default: mornings
  let hour = parseInt(m[1], 10);
  if (/pm/i.test(scheduleTime) && hour < 12) hour += 12;
  else if (/am/i.test(scheduleTime) && hour === 12) hour = 0;
  return hour;
}

// Facts the user handed over when it asked — they ride along every run,
// so an answer given once is remembered forever.
export function contextLines(buddy) {
  const facts = Array.isArray(buddy?.context)
    ? buddy.context.filter((f) => typeof f === "string" && f.trim())
    : [];
  if (!facts.length) return [];
  return [
    "Details the user gave you when you asked — use them and don't ask again:",
    ...facts.map((f) => "- " + f.trim().slice(0, 2000))
  ];
}

// The rules every findings call shares — sources are proof of work.
export const FINDINGS_RULES = [
  "Set should_notify=true only when the person should be interrupted now. For watch/repeat/reminder requests, use false when the condition has not happened or nothing meaningful changed. For a one-time request, use true when you have a useful answer.",
  "Do not ask for optional details when the request is already answerable. For provider comparisons (plumbers, electricians, mechanics, cleaners, dentists, restaurants, etc.), if a city/ZIP/location is already present, compare providers generally using public ratings, published/service-call pricing, availability, and 'quote required' where exact pricing is unavailable. Do NOT ask what exact repair/service/job they need unless the user explicitly asks for a quote for that specific job.",
  "For every web-based finding include source_name (the site or store it came from) and the exact URL it was read from.",
  "Links must take the person as close as possible to the exact thing you are recommending or describing. Use the direct article, product detail page, listing, business/profile/service page, event page, route/search result, booking page, or other specific destination that supports the finding. Do not substitute a site's homepage, generic landing page, or category page when a more specific page was actually available.",
  "Only give a URL you actually read — never invent, guess, or manufacture a deep link. If the only URL you can verify is a generic homepage, leave url empty instead of presenting it as the destination.",
  "For provider comparisons, prefer the direct provider profile or specific official service/contact page that supports the rating, price, or availability claim. Do not send the person to a directory homepage.",
  "When the finding is a specific product, listing, or deal, also include a product object: name, price as a short string (like \"price under $1.50\" → \"$1.29/lb\"), stock only when the page shows it, image_url — the exact product image URL shown on the page — and url, the direct link to that product's own page (never a search results or homepage). For product findings, make a real effort to read the listing page and copy its main product image URL; never invent one, and omit image_url only when the page truly shows no image.",
  "Only include a product object when the finding is a genuinely purchasable product with a real price or product photo — never for news, reminders, permit openings, birthdays, or general updates; those are plain findings with no product object.",
  "If today has nothing genuinely useful, say so plainly — never invent codes or prices.",
  "Only when a detail from the user would genuinely change the answer, set needs_context to ONE short friendly question asking for exactly that detail and return findings: []. Examples: a flight search without a departure city/airport; a local-service search without a location; a birthday reminder without the person/date; an account-specific request without the account. Never ask for information already present in the request.",
  "Open-ended discovery is allowed. For broad retail-arbitrage/resale scans that already name the source stores and resale marketplaces, do NOT ask for a product category or specific items. Treat the broad scope as intentional, scan across verifiable products, and return the strongest opportunities you can support.",
  "For retail arbitrage, calculate the buy side from verifiable current store price minus only coupons/discounts/loyalty offers whose eligibility you can confirm. Compare with verifiable Amazon/eBay resale pricing. When fees, shipping, tax, condition, or sell-through are unknown, label them as unknown or estimated instead of inventing them. Prefer findings that show enough numbers to understand the potential spread and direct links to the exact source product/listing pages.",
  "CRITICAL for retail arbitrage: each VERIFIED opportunity MUST include an arbitrage object with item_name, retailer, marketplace, buy_price, discount_amount, discount_description, net_buy_cost, resale_price, estimated_fees, buy_url, resale_url, and caveat. buy_url must be the exact retailer product/deal page and resale_url must be the exact Amazon/eBay product/listing/search evidence page used for the resale price. A store flyer, deals hub, homepage, category page, or generic marketplace homepage is not enough evidence for a verified opportunity.",
  "Do not throw away a strong candidate merely because one side still needs verification. When you have a SPECIFIC item plus a direct non-generic URL and price on exactly one side, return arbitrage_lead instead of arbitrage. Include item_name, retailer, marketplace, identifier when available (UPC/SKU/model), the verified side's price+URL, missing_evidence, reason, and confidence. Never put a generic flyer/deals page in arbitrage_lead. Leads are research candidates only and must not be counted as profit yet.",
  "For arbitrage discovery, work identifier-first: preserve UPC, SKU, model number, size/count, color/variant, or another exact identifier whenever available so the resale cross-match does not compare a different variant. Search broadly enough to create a candidate pool before filtering; do not stop after the first few pages.",
  "If no item clears the verified-opportunity bar but specific one-sided leads exist, return those leads with should_notify=false rather than returning findings: []. If neither verified opportunities nor specific one-sided leads exist, return findings: [] and should_notify=false; do not return a 'could not verify' sentence as though it were an opportunity.",
  "When the person asks to compare a small number of options, structure the findings so each option is directly comparable on the requested dimensions. Prefer one finding per option with its own rating/price/availability/source instead of separate generic market-price findings.",
  "For each finding, set why_fit to one short sentence only when a remembered preference or explicit request constraint clearly makes that option a better fit for this person. Examples: '$58 under your budget', 'matches your nonstop preference', 'near your saved home area'. Leave why_fit empty when there is no genuine personalized reason. Never invent a preference.",
  "For current news, breaking developments, technology releases, company announcements, laws, safety claims, or other time-sensitive facts: prefer primary sources first (official company/government/release pages), then Reuters/AP or other major established reporting. Avoid SEO aggregators and low-authority roundup sites when a stronger source is available. Extraordinary claims should be supported by a primary source or a major independent outlet, not just a niche aggregator.",
  "For flight searches: if the request includes origin, destination, travel dates (or a clearly flexible month/window), cabin/stop constraints, and budget, return current fare options instead of asking another question. Prefer directly bookable/searchable sources such as Google Flights, airline sites, Expedia, or similar. When the source provides a route/date-specific search or booking URL, return that exact deep link — never an airline or travel site's homepage. Clearly state whether each price is roundtrip or one-way, the route, requested dates when the source verifies them, airline when available, and the exact source URL. If a page only shows a route-level or monthly starting fare, label it honestly as a starting/route fare rather than implying that exact itinerary is available at that price. Never invent live inventory or a fare you did not verify. Do not attach a product object to a flight result unless the source actually shows a fare for the requested itinerary; otherwise return it as a plain finding with its direct route/search/booking URL when verified.",
  "For one-time research, do not say 'nothing new' or imply you will keep watching unless the request is actually a watch/repeat request. If no reliable answer is available, say what could not be verified or ask for the missing detail."
];

export const FINDINGS_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          source_name: { type: "string" },
          url: { type: "string" },
          why_fit: { type: "string" },
          deal: {
            type: "object",
            properties: {
              address: { type: "string" }, zip_code: { type: "string" }, property_type: { type: "string" },
              list_price: { type: "number" }, arv: { type: "number" }, arv_low: { type: "number" }, arv_high: { type: "number" },
              repairs: { type: "number" }, repair_basis: { type: "string" }, flipper_max: { type: "number" }, max_contract: { type: "number" },
              assignment_fee: { type: "number" }, investor_arv_percent: { type: "number" }, deal_score: { type: "number" },
              days_on_market: { type: "number" }, price_cuts: { type: "number" }, listing_type: { type: "string" },
              square_footage: { type: "number" }, bedrooms: { type: "number" }, bathrooms: { type: "number" },
              listing_url: { type: "string" }, listing_source: { type: "string" }, image_url: { type: "string" }, caveat: { type: "string" },
              comps: { type: "array", items: { type: "object", properties: { address: { type: "string" }, price: { type: "number" }, distance: { type: "number" }, correlation: { type: "number" } } } }
            }
          },
          product: {
            type: "object",
            properties: {
              name: { type: "string" },
              image_url: { type: "string" },
              price: { type: "string" },
              stock: { type: "string" },
              url: { type: "string" }
            }
          },
          arbitrage: {
            type: "object",
            properties: {
              item_name: { type: "string" },
              retailer: { type: "string" },
              marketplace: { type: "string" },
              buy_price: { type: "number" },
              discount_amount: { type: "number" },
              discount_description: { type: "string" },
              net_buy_cost: { type: "number" },
              resale_price: { type: "number" },
              estimated_fees: { type: "number" },
              buy_url: { type: "string" },
              resale_url: { type: "string" },
              caveat: { type: "string" }
            }
          },
          arbitrage_lead: {
            type: "object",
            properties: {
              item_name: { type: "string" },
              retailer: { type: "string" },
              marketplace: { type: "string" },
              identifier: { type: "string" },
              buy_price: { type: "number" },
              resale_price: { type: "number" },
              buy_url: { type: "string" },
              resale_url: { type: "string" },
              missing_evidence: { type: "string" },
              reason: { type: "string" },
              confidence: { type: "number" }
            }
          }
        },
        required: ["text"]
      }
    },
    needs_context: { type: "string" },
    should_notify: { type: "boolean" }
  },
  required: ["findings", "should_notify"]
};

// Generic homepages are technically valid URLs but poor handoff destinations.
// Strip them at the shared boundary so every result surface — preview, thread,
// scheduler, and orchestrated runs — follows the same deep-link standard.
export function sanitizeResultUrl(value) {
  let url = typeof value === "string" ? value.trim() : "";
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return "";
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    const genericPath = /^\/(?:home|index(?:\.html?|\.php)?)$/i.test(path);
    const meaningfulQueryKeys = [...parsed.searchParams.keys()].filter(
      (key) => !/^(?:utm_.+|gclid|fbclid|msclkid|ref|referrer|source)$/i.test(key)
    );
    const bareHomepage = path === "/" && !parsed.hash && meaningfulQueryKeys.length === 0;
    if (bareHomepage || genericPath) return "";
    return parsed.toString().slice(0, 800);
  } catch (_) {
    return "";
  }
}

// Turns whatever the model returned into bounded finding objects:
// { text, url, source }. Anything that isn't a real, useful destination is dropped.
export function toFindingItems(raw, limit = 5) {
  const list = Array.isArray(raw) ? raw : [];
  const maxItems = Math.max(1, Math.min(12, Number(limit) || 5));
  const items = [];
  for (const f of list) {
    const text = (typeof f === "string" ? f : f?.text || "").trim().slice(0, 160);
    if (!text) continue;
    const url = sanitizeResultUrl(f?.url);
    let source = typeof f?.source_name === "string" ? f.source_name.trim().slice(0, 60) : "";
    const why_fit = typeof f?.why_fit === "string" ? f.why_fit.trim().slice(0, 140) : "";
    if (url && !source) {
      try {
        source = new URL(url).hostname.replace(/^www\./, "");
      } catch (_) {
        /* the hostname is a nicety, not a requirement */
      }
    }
    let deal = null;
    const d = f && typeof f === "object" ? f.deal : null;
    if (d && typeof d === "object" && typeof d.address === "string" && Number(d.arv) > 0) {
      deal = {
        address: d.address.slice(0, 160), zip_code: String(d.zip_code || '').slice(0, 12), property_type: String(d.property_type || '').slice(0, 60),
        list_price: Number(d.list_price) || 0, arv: Number(d.arv) || 0, arv_low: Number(d.arv_low) || 0, arv_high: Number(d.arv_high) || 0,
        repairs: Number(d.repairs) || 0, repair_basis: String(d.repair_basis || '').slice(0, 120), flipper_max: Number(d.flipper_max) || 0,
        max_contract: Number(d.max_contract) || 0, assignment_fee: Number(d.assignment_fee) || 0, investor_arv_percent: Number(d.investor_arv_percent) || 0,
        deal_score: Number(d.deal_score) || 0, days_on_market: Number(d.days_on_market) || 0, price_cuts: Number(d.price_cuts) || 0,
        listing_type: String(d.listing_type || '').slice(0, 60), square_footage: Number(d.square_footage) || 0, bedrooms: Number(d.bedrooms) || 0,
        bathrooms: Number(d.bathrooms) || 0, listing_url: sanitizeResultUrl(d.listing_url),
        listing_source: String(d.listing_source || '').slice(0, 60), image_url: /^https?:\/\//i.test(String(d.image_url || '')) ? String(d.image_url).slice(0, 500) : '',
        caveat: String(d.caveat || '').slice(0, 400), comps: Array.isArray(d.comps) ? d.comps.slice(0, 5).map((c) => ({ address: String(c?.address || '').slice(0, 140), price: Number(c?.price) || 0, distance: Number(c?.distance) || 0, correlation: Number(c?.correlation) || 0 })).filter((c) => c.address && c.price) : []
      };
    }
    // A product finding carries its own card data: name, image, price, stock.
    // Only a real purchasable thing becomes a card — it needs an actual
    // price or product photo. Anything else stays a plain finding.
    let product = null;
    const p = f && typeof f === "object" ? f.product : null;
    if (p && typeof p === "object") {
      const clean = (v) =>
        typeof v === "string" && !/not (displayed|specified|available|known)|n\/a|unknown/i.test(v)
          ? v.trim().slice(0, 40)
          : "";
      const price = clean(p.price);
      const imageUrl =
        typeof p.image_url === "string" && /^https?:\/\//i.test(p.image_url.trim())
          ? p.image_url.trim().slice(0, 300)
          : "";
      // The product's own page beats the finding's source link — it's the
      // direct route to buy the thing.
      const pUrl = sanitizeResultUrl(p.url);
      if (price || imageUrl) {
        product = {
          name: (typeof p.name === "string" ? p.name.trim().slice(0, 80) : "") || text.slice(0, 60),
          image_url: imageUrl,
          price,
          stock: clean(p.stock),
          url: pUrl || url
        };
      }
    }
    const a = f && typeof f === "object" ? f.arbitrage : null;
    const arbitrage = normalizeArbitrageCandidate(a, sanitizeResultUrl);
    const leadRaw = f && typeof f === "object" ? f.arbitrage_lead : null;
    const arbitrage_lead = arbitrage ? null : normalizeArbitrageLead(leadRaw, sanitizeResultUrl);
    const finalUrl = arbitrage?.buy_url || arbitrage_lead?.buy_url || arbitrage_lead?.resale_url || url;
    const finalSource = source || arbitrage?.retailer || arbitrage_lead?.retailer || arbitrage_lead?.marketplace || '';
    const finalWhyFit = (arbitrage || arbitrage_lead) ? '' : why_fit;
    items.push({ text, url: finalUrl, source: finalSource, why_fit: finalWhyFit, deal, product, arbitrage, arbitrage_lead });
    if (items.length >= maxItems) break;
  }
  return items;
}

// The line format that gets pinned, emailed, and texted — the source
// travels with the finding so the reader can always check the work.
export function toLines(items) {
  return (items || []).map((it) =>
    it.url ? `${it.text} (Source: ${it.source || "web"} — ${it.url})` : it.text
  );
}

// Sends one SMS via Twilio. Returns false when texting isn't configured for
// this app, so the caller can fall back to email instead of dropping the
// findings on the floor.
async function sendSms(to, body) {
  const sid = secrets.get("TWILIO_ACCOUNT_SID");
  const token = secrets.get("TWILIO_AUTH_TOKEN");
  const from = secrets.get("TWILIO_FROM_NUMBER");
  if (!sid || !token || !from) return false;

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(sid + ":" + token),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ To: to, From: from, Body: body.slice(0, 300) })
  });
  if (!res.ok) throw new Error("Twilio responded " + res.status);
  return true;
}

async function runGenericWebFindings({ client, buddy, imageUrl, timeZone, personalFacts, delegationLines, linkedLines = [], taskLines = [] }) {
  const requestText = `${buddy.note || ''} ${buddy.what_line || ''}`;
  const broadArbitrage = isBroadArbitrageScan(requestText);
  const arbitrageTarget = broadArbitrage ? extractArbitrageProfitTarget(requestText) : 0;
  const priorArbitrageLeads = broadArbitrage && Array.isArray(buddy?.arbitrage_leads) ? buddy.arbitrage_leads.slice(0, 12) : [];
  return await client.asServiceRole.integrations.Core.InvokeLLM({
    model: "gemini_3_flash",
    add_context_from_internet: true,
    ...(imageUrl ? { file_urls: [imageUrl] } : {}),
    prompt: [
      "You are handling one thing for one person.",
      'Their exact words: "' + buddy.note + '"',
      "How this should behave: " + (buddy.run_mode || "watch") + ".",
      "What to handle: " + (buddy.what_line || buddy.note),
      "Today's local date: " + nowInZone(timeZone).date + ".",
      ...(Array.isArray(personalFacts) && personalFacts.length ? [
        "Relevant things this person previously asked Buddy to remember. Use them only when helpful and never override the current request:",
        ...personalFacts.slice(0, 12).map((f) => "- " + String(f).slice(0, 220)),
        "When a remembered preference affects the recommendation, explain that briefly in the result when useful."
      ] : []),
      ...(Array.isArray(delegationLines) ? delegationLines : []),
      ...(Array.isArray(linkedLines) ? linkedLines : []),
      ...(Array.isArray(taskLines) ? taskLines : []),
      ...contextLines(buddy),
      ...(imageUrl
        ? [
            "A photo of the exact thing to track is attached. Treat it like a reverse image search:",
            "identify the product in the photo and report today's best prices and where to buy it."
          ]
        : []),
      "Handle the request for today. Use current web information when the request needs it; do not force a web search for a personal reminder or simple planning task.",
      arbitrageTarget > 0 ? `This person has a $${arbitrageTarget.toLocaleString()} aggregate profit target. Treat it as the combined weekly goal across multiple opportunities unless they explicitly say each/per item/per deal. Do not require one opportunity to make the full target. Return useful positive-spread opportunities even when today's verified total is below the target.` : "",
      priorArbitrageLeads.length ? `First try to finish verification on these unresolved leads from the prior run before starting over. Keep exact variants/identifiers straight and drop stale mismatches: ${JSON.stringify(priorArbitrageLeads).slice(0, 7000)}` : "",
      broadArbitrage ? "If the user did not name retailers or resale marketplaces, default to broad current U.S. retail/online sourcing and Amazon/eBay resale evidence. Prefer opportunities that can plausibly be acted on this week. Do not ask for a category, store, or marketplace merely to narrow the scan." : "",
      broadArbitrage ? "Build a broad candidate pool first, then return up to 12 strongest results. Verified opportunities should clear both evidence sides; exact one-sided candidates should be returned as arbitrage_lead so Buddy can continue verifying them on the next run." : "Return up to 5 useful, concrete findings. Each finding is one short plain sentence (under 120 characters) with specifics — prices, codes, dates, names.",
      ...FINDINGS_RULES
    ].join("\n"),
    response_json_schema: FINDINGS_SCHEMA
  });
}

export async function runBuddy({ client, entityClient, buddy, userEmail, notifyEmail, smsPhone, timeZone, metaToken, metaAccount, metaPage, personalFacts = [], delegationLines = [] }) {
  // A photo pinned to the note rides along every run — reverse-search style.
  const imageUrl =
    typeof buddy.image_url === "string" && /^https?:\/\//i.test(buddy.image_url.trim())
      ? buddy.image_url.trim()
      : "";
  const linkedBuddies = await loadLinkedBuddies(client, buddy.owner_id, buddy.linked_buddy_ids);
  const linkedLines = linkedBuddyPromptLines(linkedBuddies);
  const taskLines = taskStepPromptLines(buddy.task_steps);
  let findings;
  const requestTextForRouting = `${buddy.note || ''} ${buddy.what_line || ''}`;
  if (buddy.kind === "web" && isBroadArbitrageScan(requestTextForRouting)) {
    try {
      findings = await runRetailArbitragePipeline({ base44: client, buddy, personalFacts });
    } catch (_) {
      // The dedicated fan-out pipeline is preferred for arbitrage, but a
      // specialist outage must not make the handoff unusable.
      try {
        findings = await runOrchestratedBuddy({ base44: client, buddy, personalFacts, delegationLines, linkedContextLines: linkedLines });
      } catch (_) {
        findings = await runGenericWebFindings({ client, buddy, imageUrl, timeZone, personalFacts, delegationLines, linkedLines, taskLines });
      }
    }
  } else if (buddy.kind === "web" && (buddy.execution_mode === "chain" || shouldOrchestrateRequest(requestTextForRouting))) {
    try {
      findings = await runOrchestratedBuddy({ base44: client, buddy, personalFacts, delegationLines, linkedContextLines: linkedLines });
    } catch (_) {
      // Complex work should degrade gracefully. The specialist layer is an
      // upgrade, never a single point of failure.
      findings = isWholesalePropertyRequest(requestTextForRouting)
        ? await runWholesaleDealFinder({ base44: client, buddy })
        : await runGenericWebFindings({ client, buddy, imageUrl, timeZone, personalFacts, delegationLines, linkedLines, taskLines });
    }
  } else if (buddy.kind === "web" && isWholesalePropertyRequest(requestTextForRouting)) {
    findings = await runWholesaleDealFinder({ base44: client, buddy });
  } else if (buddy.kind === "ads") {
    // Ad notes read the person's own ad account, not the web — the
    // token they pasted in Settings decides what they can touch.
    findings = await runAdsBuddy({
      client,
      buddy,
      facts: contextLines(buddy),
      token: metaToken,
      account: metaAccount
    });
  } else if (buddy.kind === "social") {
    // Page notes write the person's Facebook Page — the token they pasted
    // in Settings decides which Page they can reach.
    findings = await runSocialBuddy({
      client,
      buddy,
      facts: contextLines(buddy),
      token: metaToken,
      pageId: metaPage,
      timeZone
    });
  } else {
    findings = await runGenericWebFindings({ client, buddy, imageUrl, timeZone, personalFacts, delegationLines, linkedLines, taskLines });
  }

  // The one case where guessing is wrong: a detail the user could hand over
  // in one line is missing. Ask instead of invent — the question lands in
  // the thread and, when a number is on file, as a text.
  let question =
    typeof findings?.needs_context === "string" ? findings.needs_context.trim().slice(0, 200) : "";
  question = suppressOptionalClarification(`${buddy.note || ''} ${buddy.what_line || ''}`, question);

  // Deterministic guard against model over-clarification. If a comparison
  // already names a usable location, a specific repair/project is optional.
  // Answer with public pricing/ratings/availability and say "quote required"
  // rather than turning a complete preset into another question.
  const requestText = `${buddy.note || ''} ${buddy.what_line || ''}`;
  const providerComparison = /\b(compare|comparison|find\s+(?:three|3|several|a few))\b/i.test(requestText) &&
    /\b(plumber|electrician|mechanic|cleaner|dentist|contractor|roofer|salon|barber|restaurant)s?\b/i.test(requestText);
  const hasUsableLocation = /\b(?:in|near|around)\s+[A-Za-z][A-Za-z .'-]{1,40}\b/i.test(requestText) ||
    /\b\d{5}(?:-\d{4})?\b/.test(requestText) ||
    (Array.isArray(buddy.context) && buddy.context.some((x) => /\b\d{5}(?:-\d{4})?\b|[A-Za-z]{3,}/.test(String(x || ''))));
  if (providerComparison && hasUsableLocation && /\b(specific|which|what).*(service|repair|project|issue|job)|\b(service|repair|project|issue|job).*(need|looking for)\b/i.test(question)) {
    question = '';
  }

  if (question) {
    const msg = { who: "note", at: new Date().toISOString(), text: question };
    const messages = [...(Array.isArray(buddy.messages) ? buddy.messages : []), msg];
    await entityClient.entities.Buddy.update(buddy.id, {
      messages,
      last_run_date: nowInZone(timeZone).date,
      open_question: question
    });
    let questionSmsSent = false;
    if (typeof smsPhone === "string" && smsPhone.trim().startsWith("+")) {
      try {
        questionSmsSent = await sendSms(
          smsPhone.trim(),
          buddy.name + " needs one detail:\n" + question
        );
      } catch (e) {
        questionSmsSent = false;
      }
    }
    if (!questionSmsSent && typeof userEmail === "string" && userEmail.includes("@")) {
      try {
        await client.asServiceRole.integrations.Core.SendEmail({
          to: userEmail,
          subject: buddy.name + " needs one detail",
          body: question
        });
      } catch (e) {
        /* the question is already pinned in the thread */
      }
    }
    return { items: [], lines: [question], question: true, deliveredBySms: questionSmsSent };
  }

  let shouldNotify = findings?.should_notify !== false;
  const broadArbitrage = isBroadArbitrageScan(requestText);
  const arbitrageTarget = broadArbitrage ? extractArbitrageProfitTarget(requestText) : 0;
  let items = toFindingItems(findings?.findings, broadArbitrage ? 12 : 5);
  if (broadArbitrage) {
    items = items.filter((item) => item?.arbitrage || item?.arbitrage_lead);
    const verifiedCount = items.filter((item) => item?.arbitrage).length;
    shouldNotify = shouldNotify && verifiedCount > 0;
  }
  let lines;
  if (items.length && broadArbitrage) {
    const portfolio = arbitragePortfolioSummary(items, arbitrageTarget);
    const leadCount = items.filter((item) => item?.arbitrage_lead).length;
    const progress = arbitrageTarget > 0
      ? `This run found $${portfolio.verified_potential.toLocaleString()} in estimated one-unit profit across ${portfolio.count} verified opportunities toward your $${arbitrageTarget.toLocaleString()} weekly target. Gap: $${portfolio.gap.toLocaleString()}.${leadCount ? ` Buddy also kept ${leadCount} promising lead${leadCount === 1 ? '' : 's'} that still need one side verified; they are not counted toward the target yet.` : ''} This is opportunity math, not guaranteed profit or confirmed inventory quantity.`
      : `This run found $${portfolio.verified_potential.toLocaleString()} in estimated one-unit profit across ${portfolio.count} verified opportunities.${leadCount ? ` Buddy also kept ${leadCount} promising lead${leadCount === 1 ? '' : 's'} that still need one side verified.` : ''} This is opportunity math, not guaranteed profit or confirmed inventory quantity.`;
    lines = [progress, ...toLines(items)];
  } else if (items.length) {
    lines = toLines(items);
  } else {
    lines = [broadArbitrage
      ? (arbitrageTarget > 0
          ? `No specific arbitrage opportunity cleared Buddy’s evidence and profit checks on this run. Your $${arbitrageTarget.toLocaleString()} weekly target stays in place; Buddy should keep scanning broadly on the next scheduled run.`
          : "No specific arbitrage opportunity cleared Buddy’s evidence and profit checks today.")
      : (shouldNotify ? "Nothing useful turned up this time." : "Nothing changed — still keeping an eye on it.")];
  }

  const today = nowInZone(timeZone).date;
  const finishing = buddy.run_mode === "once";
  const unresolvedArbitrageLeads = broadArbitrage
    ? items.filter((item) => item?.arbitrage_lead).slice(0, 12).map((item) => ({ ...item.arbitrage_lead, last_seen_at: new Date().toISOString() }))
    : undefined;
  await entityClient.entities.Buddy.update(buddy.id, {
    last_result: lines,
    last_run_date: today,
    ...(broadArbitrage ? { arbitrage_leads: unresolvedArbitrageLeads, arbitrage_leads_updated_at: new Date().toISOString() } : {}),
    ...(finishing ? { status: "done" } : {})
  });

  // The TELLS line decides the channel: "text me" → SMS only,
  // "email me" → email only, anything else → both.
  const delivery = parseDelivery(buddy.how_line || "");

  let smsSent = false;
  if (shouldNotify && delivery.sms && typeof smsPhone === "string" && smsPhone.trim().startsWith("+")) {
    try {
      smsSent = await sendSms(
        smsPhone.trim(),
        buddy.name + " pinned something for you:\n" + lines.join("\n")
      );
    } catch (e) {
      // text failure should never fail the run — findings are already pinned
      smsSent = false;
    }
  }

  // Email goes out when the switch is on, and also as the rescue when a note
  // asked to be texted but no text could leave (no number saved, or texting
  // isn't configured for this app) — findings should never vanish quietly.
  const canEmail = typeof userEmail === "string" && userEmail.includes("@");
  const rescueEmail = shouldNotify && delivery.sms && !smsSent;
  if (shouldNotify && canEmail && ((delivery.email && notifyEmail) || rescueEmail)) {
    try {
      await client.asServiceRole.integrations.Core.SendEmail({
        to: userEmail,
        subject: buddy.name + " pinned something for you",
        body: lines.join("\n")
      });
    } catch (e) {
      // email failure should never fail the run — findings are already pinned
    }
  }

  return { items, lines, deliveredBySms: smsSent, notified: shouldNotify };
}
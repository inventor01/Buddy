// Runs one buddy: searches the web for today's findings, pins them back on
// the buddy's lantern, and delivers them by email and/or text message.
// Every finding carries proof of work — the site it came from and the
// exact URL it was read at. Shared by the hourly scheduler, the "Run now"
// button, and the visitor preview.

import { secrets } from "base44:runtime";
import { parseDelivery } from "./plan.ts";
import { runAdsBuddy } from "./ads.ts";

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
      hour: "2-digit"
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
    // some runtimes render midnight as 24
    hour: Number.isNaN(hour) ? 0 : hour % 24
  };
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
    ...facts.map((f) => "- " + f.trim().slice(0, 300))
  ];
}

// The rules every findings call shares — sources are proof of work.
export const FINDINGS_RULES = [
  "For every finding include source_name (the site or store it came from) and the exact URL it was read from.",
  "Only give a URL you actually read — never invent one. If a finding has no source URL, leave url empty.",
  "When the finding is a specific product, listing, or deal, also include a product object: name, price as a short string (like \"price under $1.50\" → \"$1.29/lb\"), stock only when the page shows it, image_url — the exact product image URL shown on the page — and url, the direct link to that product's own page (never a search results or homepage). For product findings, make a real effort to read the listing page and copy its main product image URL; never invent one, and omit image_url only when the page truly shows no image.",
  "Only include a product object when the finding is a genuinely purchasable product with a real price or product photo — never for news, reminders, permit openings, birthdays, or general updates; those are plain findings with no product object.",
  "If today has nothing genuinely useful, say so plainly — never invent codes or prices.",
  "Only when a detail from the user would genuinely change the answer (which account, whose birthday, which store, which exact item), set needs_context to ONE short friendly question asking for exactly that detail and return findings: []. Never use needs_context just because today is quiet — quiet days get an honest \"nothing new\" finding instead."
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
          product: {
            type: "object",
            properties: {
              name: { type: "string" },
              image_url: { type: "string" },
              price: { type: "string" },
              stock: { type: "string" },
              url: { type: "string" }
            }
          }
        },
        required: ["text"]
      }
    },
    needs_context: { type: "string" }
  },
  required: ["findings"]
};

// Turns whatever the model returned into bounded finding objects:
// { text, url, source }. Anything that isn't a real link is dropped.
export function toFindingItems(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const items = [];
  for (const f of list) {
    const text = (typeof f === "string" ? f : f?.text || "").trim().slice(0, 160);
    if (!text) continue;
    let url = typeof f?.url === "string" ? f.url.trim() : "";
    if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
    try {
      if (url) new URL(url);
    } catch (_) {
      url = "";
    }
    let source = typeof f?.source_name === "string" ? f.source_name.trim().slice(0, 60) : "";
    if (url && !source) {
      try {
        source = new URL(url).hostname.replace(/^www\./, "");
      } catch (_) {
        /* the hostname is a nicety, not a requirement */
      }
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
      let pUrl = typeof p.url === "string" ? p.url.trim() : "";
      if (pUrl && !/^https?:\/\//i.test(pUrl)) pUrl = "https://" + pUrl;
      try {
        if (pUrl) new URL(pUrl);
      } catch (_) {
        pUrl = "";
      }
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
    items.push({ text, url, source, product });
    if (items.length >= 5) break;
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

export async function runBuddy({ client, entityClient, buddy, userEmail, notifyEmail, smsPhone, timeZone, metaToken, metaAccount }) {
  // A photo pinned to the note rides along every run — reverse-search style.
  const imageUrl =
    typeof buddy.image_url === "string" && /^https?:\/\//i.test(buddy.image_url.trim())
      ? buddy.image_url.trim()
      : "";
  let findings;
  if (buddy.kind === "ads") {
    // Ad notes read the person's own ad account, not the web — the
    // token they pasted in Settings decides what they can touch.
    findings = await runAdsBuddy({
      client,
      buddy,
      facts: contextLines(buddy),
      token: metaToken,
      account: metaAccount
    });
  } else {
  findings = await client.asServiceRole.integrations.Core.InvokeLLM({
    model: "gemini_3_flash",
    add_context_from_internet: true,
    ...(imageUrl ? { file_urls: [imageUrl] } : {}),
    prompt: [
      "You are " + buddy.name + ", a helper for one person.",
      'Their exact words: "' + buddy.note + '"',
      "Your daily job: " + (buddy.what_line || buddy.note),
      ...contextLines(buddy),
      ...(imageUrl
        ? [
            "A photo of the exact thing to track is attached. Treat it like a reverse image search:",
            "identify the product in the photo and report today's best prices and where to buy it."
          ]
        : []),
      "Search the web for today and report back the 5 most useful, concrete findings for this job.",
      "Each finding is one short plain sentence (under 120 characters) with specifics — prices, codes, dates, names.",
      ...FINDINGS_RULES
    ].join("\n"),
    response_json_schema: FINDINGS_SCHEMA
  });
  }

  // The one case where guessing is wrong: a detail the user could hand over
  // in one line is missing. Ask instead of invent — the question lands in
  // the thread and, when a number is on file, as a text.
  const question =
    typeof findings?.needs_context === "string" ? findings.needs_context.trim().slice(0, 200) : "";
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

  const items = toFindingItems(findings?.findings);
  if (items.length === 0) {
    items.push({ text: "Nothing new today — I will look again next time.", url: "", source: "" });
  }
  const lines = toLines(items);

  const today = nowInZone(timeZone).date;
  await entityClient.entities.Buddy.update(buddy.id, { last_result: lines, last_run_date: today });

  // The TELLS line decides the channel: "text me" → SMS only,
  // "email me" → email only, anything else → both.
  const delivery = parseDelivery(buddy.how_line || "");

  let smsSent = false;
  if (delivery.sms && typeof smsPhone === "string" && smsPhone.trim().startsWith("+")) {
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
  const rescueEmail = delivery.sms && !smsSent;
  if (canEmail && ((delivery.email && notifyEmail) || rescueEmail)) {
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

  return { items, lines, deliveredBySms: smsSent };
}
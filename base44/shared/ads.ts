// Meta (Facebook & Instagram) ads through an access token each person
// pastes in Settings — no OAuth app to build or connect. This is the
// engine behind ad notes: it reads the live numbers, follows the rules
// in the note (watch spend, pause, resume, budgets), and builds a new
// ad when asked in the thread. Graph API v25.0, per Meta's guide.

const GRAPH = "https://graph.facebook.com/v25.0";

// Raw Graph calls — Meta's own error messages say exactly what to fix
// (expired token, missing permission, invalid budget), so they surface
// to the user instead of a generic "something went wrong".
async function graphGet(token, path, params = {}) {
  const qs = new URLSearchParams({ access_token: token, ...params });
  const res = await fetch(`${GRAPH}/${path}?${qs}`);
  const data = await res.json().catch(() => null);
  if (data?.error) {
    throw new Error(`${data.error.message} (Meta code ${data.error.code ?? "?"})`);
  }
  return data;
}

async function graphPost(token, path, body = {}) {
  const res = await fetch(`${GRAPH}/${path}?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => null);
  if (data?.error) {
    throw new Error(`${data.error.message} (Meta code ${data.error.code ?? "?"})`);
  }
  return data;
}

export async function listAdAccounts(token) {
  const res = await graphGet(token, "me/adaccounts", { fields: "account_id,name", limit: "25" });
  return (res.data || []).map((a) => ({ account_id: a.account_id, name: a.name }));
}

function normalizeAccount(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? "act_" + digits : "";
}

function adsManagerUrl(actId) {
  return `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${actId.replace(/\D/g, "")}`;
}

// The live picture of one ad account: campaigns and ad sets with their
// last-7-day numbers, ready to feed to the decision call.
async function snapshot(token, actId) {
  const campaigns = await graphGet(token, `${actId}/campaigns`, {
    fields: "id,name,effective_status,insights.date_preset(last_7d){spend,impressions,clicks,cpc,ctr,purchase_roas}",
    limit: "25"
  });
  const adsets = await graphGet(token, `${actId}/adsets`, {
    fields: "id,name,effective_status,daily_budget,insights.date_preset(last_7d){spend,clicks,cpc}",
    limit: "50"
  });
  return { campaigns: campaigns.data || [], adsets: adsets.data || [] };
}

function describeSnapshot(snap) {
  const lines = [];
  for (const c of snap.campaigns.slice(0, 10)) {
    const i = (c.insights || [])[0] || {};
    const roas = Array.isArray(i.purchase_roas) && i.purchase_roas[0] ? i.purchase_roas[0].value : "n/a";
    lines.push(
      `Campaign "${c.name}" id=${c.id} — ${c.effective_status} — spend $${i.spend || "0"} last 7 days — ` +
        `${i.clicks || 0} clicks — CPC ${i.cpc ? "$" + i.cpc : "n/a"} — ROAS ${roas}`
    );
  }
  for (const s of snap.adsets.slice(0, 10)) {
    const i = (s.insights || [])[0] || {};
    lines.push(
      `Ad set "${s.name}" id=${s.id} — ${s.effective_status} — daily budget ${
        s.daily_budget ? "$" + (s.daily_budget / 100).toFixed(2) : "not set"
      } — spend $${i.spend || "0"} — ${i.clicks || 0} clicks`
    );
  }
  return lines.length ? lines.join("\n") : "No campaigns or ad sets in this account yet.";
}

const ADS_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          source_name: { type: "string" },
          url: { type: "string" }
        },
        required: ["text"]
      }
    },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          op: { type: "string", enum: ["pause", "resume", "budget"] },
          id: { type: "string" },
          name: { type: "string" },
          budget_usd: { type: "number" },
          reason: { type: "string" }
        },
        required: ["op", "id"]
      }
    },
    create_ad: {
      type: "object",
      properties: {
        link: { type: "string" },
        headline: { type: "string" },
        primary_text: { type: "string" },
        image_prompt: { type: "string" },
        budget_usd: { type: "number" },
        country_code: { type: "string" },
        run_now: { type: "boolean" }
      }
    }
  },
  required: ["findings"]
};

// Builds a complete new ad: campaign → ad set → creative (with a
// generated image) → ad. Created paused unless the person clearly said
// to start it, so nothing spends money without a second look.
async function createAd({ client, token, actId, spec }) {
  const budgetUsd = Math.max(5, Math.min(500, Number(spec.budget_usd) || 10));
  const country = String(spec.country_code || "US").toUpperCase().slice(0, 2);
  const headline = String(spec.headline || "New ad").slice(0, 40);
  const name = headline + " — " + new Date().toISOString().slice(0, 10);

  // An ad needs a Page to run from — the first one this token manages.
  const pages = await graphGet(token, "me/accounts", { fields: "id,name", limit: "5" });
  const page = (pages.data || [])[0];
  if (!page) throw new Error("no Facebook Page found — the ad needs a Page to run from");

  const img = await client.asServiceRole.integrations.Core.GenerateImage({
    prompt:
      String(spec.image_prompt || headline).slice(0, 300) +
      " — square social media ad creative, clean and modern, product-focused, uncluttered"
  });

  const campaign = await graphPost(token, `${actId}/campaigns`, {
    name,
    objective: "OUTCOME_TRAFFIC",
    status: "PAUSED",
    special_ad_categories: []
  });
  const adset = await graphPost(token, `${actId}/adsets`, {
    name: name + " (set)",
    campaign_id: campaign.id,
    daily_budget: Math.round(budgetUsd * 100),
    billing_event: "IMPRESSIONS",
    optimization_goal: "LINK_CLICKS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting: { geo_locations: { countries: [country] } },
    status: "PAUSED"
  });
  const creative = await graphPost(token, `${actId}/adcreatives`, {
    name,
    object_story_spec: {
      page_id: page.id,
      link_data: {
        message: String(spec.primary_text || "").slice(0, 125),
        link: spec.link,
        name: headline,
        picture: img.url
      }
    }
  });
  const ad = await graphPost(token, `${actId}/ads`, {
    name,
    adset_id: adset.id,
    creative: { creative_id: creative.id },
    status: "PAUSED"
  });
  if (spec.run_now === true) {
    await graphPost(token, campaign.id, { status: "ACTIVE" });
    await graphPost(token, adset.id, { status: "ACTIVE" });
    await graphPost(token, ad.id, { status: "ACTIVE" });
  }
  return { name: headline, budget: budgetUsd, running: spec.run_now === true };
}

// One ad run: read the account, decide with the note's rules, act
// within strict bounds. Returns the same { findings, needs_context }
// shape as a web run, so pinning and delivery work unchanged.
export async function runAdsBuddy({ client, buddy, facts = [], token = "", account = "", message = "" }) {
  const simple = (text) => ({ findings: [{ text, source_name: "Buddy" }], needs_context: "" });

  if (typeof token !== "string" || token.trim().length < 20) {
    return simple(
      "Connect your Facebook ad account first — add its access token in Settings and this note takes over from there."
    );
  }
  token = token.trim();

  try {
    let actId = normalizeAccount(account);
    if (!actId) {
      const accounts = await listAdAccounts(token);
      if (!accounts.length) {
        return simple("This token can't see any ad accounts — it needs ads_read permission. Refresh it in Settings.");
      }
      actId = "act_" + accounts[0].account_id;
    }

    const snap = await snapshot(token, actId);
    const decision = await client.asServiceRole.integrations.Core.InvokeLLM({
      model: "gemini_3_flash",
      prompt: [
        `You are ${buddy.name}, running one person's Facebook & Instagram ads.`,
        `Their exact words: "${buddy.note}"`,
        `Your daily job: ${buddy.what_line || buddy.note}`,
        ...facts,
        message ? `\nThe user says: "${message}"` : "",
        "",
        "Live numbers from their ad account (last 7 days):",
        describeSnapshot(snap),
        "",
        "Report back:",
        "- findings: up to 4 short plain sentences (under 120 characters each) about what matters today — spend, budget, ROAS, anything unusual.",
        "- actions: ONLY when their words or the message set a clear rule that is met (like \"pause anything that spends over $50\" or \"turn that one off\"), act on it: op=pause or resume with the campaign id, or op=budget with the ad set id and budget_usd. Use ONLY ids from the numbers above, at most 3 actions. When unsure, report instead of acting.",
        message
          ? "- If they're asking you to make a new ad, fill create_ad: link (the website it points to — required), headline (under 40 characters), primary_text (under 125 characters), image_prompt (a short visual description), budget_usd (daily budget, default 10), country_code (two letters, default US), run_now (true ONLY if they clearly said to start it immediately)."
          : "- Do not create ads on your own — leave create_ad empty.",
        "- If nothing needs attention, return one honest finding saying all is quiet. Never invent numbers."
      ].join("\n"),
      response_json_schema: ADS_SCHEMA
    });

    const findings = (Array.isArray(decision?.findings) ? decision.findings : []).slice(0, 4);
    const campaignIds = new Set(snap.campaigns.map((c) => String(c.id)));
    const adsetIds = new Set(snap.adsets.map((s) => String(s.id)));

    // Bounded actions: only ids from the live snapshot, at most three,
    // budgets clamped to $5–$500 a day.
    for (const a of (Array.isArray(decision?.actions) ? decision.actions : []).slice(0, 3)) {
      const id = String(a?.id || "");
      const label = `"${(a?.name || id).slice(0, 40)}"`;
      try {
        if ((a.op === "pause" || a.op === "resume") && campaignIds.has(id)) {
          await graphPost(token, id, { status: a.op === "pause" ? "PAUSED" : "ACTIVE" });
          findings.push({
            text: `${a.op === "pause" ? "Paused" : "Turned on"} ${label} — ${(a.reason || "per your rules").slice(0, 60)}`,
            source_name: "Meta Ads",
            url: adsManagerUrl(actId)
          });
        } else if (a.op === "budget" && adsetIds.has(id)) {
          const usd = Math.max(5, Math.min(500, Number(a.budget_usd) || 0));
          if (!usd) continue;
          await graphPost(token, id, { daily_budget: Math.round(usd * 100) });
          findings.push({
            text: `Set ${label} to $${usd} a day — ${(a.reason || "per your rules").slice(0, 60)}`,
            source_name: "Meta Ads",
            url: adsManagerUrl(actId)
          });
        }
      } catch (e) {
        findings.push({
          text: `Tried to ${a.op} ${label} but Meta said no: ${String(e.message).slice(0, 100)}`,
          source_name: "Meta Ads"
        });
      }
    }

    // A new ad is only ever built when the person asked for one in
    // this thread message — never on a scheduled run.
    const spec = decision?.create_ad;
    if (message && spec && typeof spec.link === "string" && /^https?:\/\//.test(spec.link)) {
      try {
        const made = await createAd({ client, token, actId, spec });
        findings.push({
          text: `New ad "${made.name}" built — $${made.budget} a day, ${
            made.running ? "running now" : 'paused until you say "turn it on"'
          }`,
          source_name: "Meta Ads",
          url: adsManagerUrl(actId)
        });
      } catch (e) {
        findings.push({
          text: `The new ad didn't go through: ${String(e.message).slice(0, 140)}`,
          source_name: "Meta Ads"
        });
      }
    }

    if (!findings.length) {
      findings.push({ text: "Nothing needs attention in your ads today.", source_name: "Meta Ads", url: adsManagerUrl(actId) });
    }
    return { findings: findings.slice(0, 5), needs_context: "" };
  } catch (e) {
    return simple("Couldn't reach your ad account: " + String(e.message).slice(0, 160));
  }
}
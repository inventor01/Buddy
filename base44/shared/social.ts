// Facebook Page posting through the same Meta access token each person
// pastes in Settings. This is the engine behind "social" notes: it writes
// today's post from the note's words (or from what the person says in the
// thread), makes an image when one helps, and pins the post's link back.
// Graph API v25.0, same call helpers as the ads engine.

import { graphGet } from "./ads.ts";

export async function listPages(token) {
  const res = await graphGet(token, "me/accounts", { fields: "id,name", limit: "25" });
  return (res.data || []).map((p) => ({ id: p.id, name: p.name }));
}

const POST_SCHEMA = {
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
    post: {
      type: "object",
      properties: {
        text: { type: "string" },
        image_prompt: { type: "string" },
        link: { type: "string" }
      }
    }
  },
  required: ["findings"]
};

// One social run: read the Page the token manages, write the post from the
// note's words (or the thread message), publish it once, and report back.
// Returns the same { findings, needs_context } shape as a web run, so
// pinning and delivery work unchanged.
export async function runSocialBuddy({ client, buddy, facts = [], token = "", pageId = "", message = "", timeZone = "" }) {
  const simple = (text) => ({ findings: [{ text, source_name: "Buddy" }], needs_context: "" });

  if (typeof token !== "string" || token.trim().length < 20) {
    return simple(
      "Connect your Facebook Page first — paste its access token in Settings and this note takes over from there."
    );
  }
  token = token.trim();

  try {
    let page = null;
    if (pageId && /^\d+$/.test(pageId)) {
      const info = await graphGet(token, pageId, { fields: "id,name" });
      page = { id: String(info.id), name: info.name || "your Page" };
    } else {
      const pages = await listPages(token);
      page = pages[0] || null;
    }
    if (!page) {
      return simple(
        "This token can't see any Facebook Pages — it needs pages_manage_posts permission. Refresh it in Settings."
      );
    }

    // Weekly or monthly jobs only fire on the right day — so the model
    // needs to know what today is, on the person's own clock.
    let dateLine = "";
    try {
      const fmt = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        ...(timeZone ? { timeZone } : {})
      });
      dateLine = `Today is ${fmt.format(new Date())} where they are.`;
    } catch (_) {
      /* the model posts without knowing the day */
    }

    const decision = await client.asServiceRole.integrations.Core.InvokeLLM({
      model: "gemini_3_flash",
      prompt: [
        `You are ${buddy.name}, managing one person's Facebook Page "${page.name}".`,
        `Their exact words: "${buddy.note}"`,
        `Your daily job: ${buddy.what_line || buddy.note}`,
        ...(dateLine ? [dateLine] : []),
        ...facts,
        message ? `\nThe user says: "${message}"` : "",
        "",
        "Report back:",
        "- findings: up to 3 short plain sentences (under 120 characters) — what you posted or why you held back. Never invent likes, comments, or numbers.",
        message
          ? "- They are asking for a post: fill post.text (the full post, friendly and specific, under 1200 characters), post.image_prompt (a short visual description — leave empty when the post works better without a picture), and post.link (a URL only when they gave one)."
          : "- If their words describe a posting job that is due today (a daily tip, a weekly deal on its day), fill post.text the same way — weekly or monthly jobs only fire on their day. If nothing is genuinely due or a needed detail is missing, leave post empty and say so in findings.",
        "- At most one post. Never invent prices, sales, or events that were not given to you."
      ].join("\n"),
      response_json_schema: POST_SCHEMA
    });

    const findings = (Array.isArray(decision?.findings) ? decision.findings : []).slice(0, 3);
    const post = decision?.post;
    if (post && typeof post.text === "string" && post.text.trim()) {
      // Production safety gate: draft only. Publishing must go through the
      // same explicit approval flow as every other outside write.
      const text = post.text.trim().slice(0, 1200);
      findings.push({
        text: `Post draft ready for review on ${page.name}: "${text.slice(0, 80)}${text.length > 80 ? "…" : ""}" Nothing was published.`,
        source_name: "Facebook"
      });
    } else if (!findings.length) {
      findings.push({ text: "Nothing to post today — I'll write when there's something.", source_name: "Facebook" });
    }
    return { findings: findings.slice(0, 5), needs_context: "" };
  } catch (e) {
    return simple("Couldn't reach your Facebook Page: " + String(e.message).slice(0, 160));
  }
}
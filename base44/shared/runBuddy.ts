// Runs one buddy: searches the web for today's findings, pins them back on
// the buddy's lantern, and delivers them by email and/or text message.
// Shared by the hourly scheduler and the "Run now" button.

import { secrets } from "base44:runtime";
import { parseDelivery } from "./plan.ts";

export function parseScheduleHour(scheduleTime) {
  const m = typeof scheduleTime === "string" ? scheduleTime.match(/(\d{1,2})/) : null;
  if (!m) return 9; // sensible default: mornings
  let hour = parseInt(m[1], 10);
  if (/pm/i.test(scheduleTime) && hour < 12) hour += 12;
  else if (/am/i.test(scheduleTime) && hour === 12) hour = 0;
  return hour;
}

// Sends one SMS via Twilio. Silently does nothing when texting isn't configured.
async function sendSms(to, body) {
  const sid = secrets.get("TWILIO_ACCOUNT_SID");
  const token = secrets.get("TWILIO_AUTH_TOKEN");
  const from = secrets.get("TWILIO_FROM_NUMBER");
  if (!sid || !token || !from) return;

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(sid + ":" + token),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ To: to, From: from, Body: body.slice(0, 300) })
  });
  if (!res.ok) throw new Error("Twilio responded " + res.status);
}

export async function runBuddy({ client, entityClient, buddy, userEmail, notifyEmail, smsPhone }) {
  const findings = await client.asServiceRole.integrations.Core.InvokeLLM({
    model: "gemini_3_flash",
    add_context_from_internet: true,
    prompt: [
      "You are " + buddy.name + ", a helper for one person.",
      'Their exact words: "' + buddy.note + '"',
      "Your daily job: " + (buddy.what_line || buddy.note),
      "Search the web for today and report back the 5 most useful, concrete findings for this job.",
      "Each finding is one short plain sentence (under 120 characters) with specifics — prices, codes, dates, names.",
      "If today has nothing genuinely useful, say so plainly — never invent codes or prices."
    ].join("\n"),
    response_json_schema: {
      type: "object",
      properties: {
        findings: { type: "array", items: { type: "string" } }
      },
      required: ["findings"]
    }
  });

  const lines = (Array.isArray(findings?.findings) ? findings.findings : [])
    .filter((f) => typeof f === "string" && f.trim())
    .slice(0, 5)
    .map((f) => f.trim().slice(0, 160));
  if (lines.length === 0) lines.push("Nothing new today — I will look again next time.");

  const today = new Date().toISOString().slice(0, 10);
  await entityClient.entities.Buddy.update(buddy.id, { last_result: lines, last_run_date: today });

  // The TELLS line decides the channel: "text me" → SMS only,
  // "email me" → email only, anything else → both.
  const delivery = parseDelivery(buddy.how_line || "");

  if (delivery.email && notifyEmail && typeof userEmail === "string" && userEmail.includes("@")) {
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

  if (delivery.sms && typeof smsPhone === "string" && smsPhone.trim().startsWith("+")) {
    try {
      await sendSms(smsPhone.trim(), buddy.name + " pinned something for you:\n" + lines.join("\n"));
    } catch (e) {
      // text failure should never fail the run — findings are already pinned
    }
  }

  return lines;
}
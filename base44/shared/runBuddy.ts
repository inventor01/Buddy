// Runs one buddy: searches the web for today's findings, pins them back on
// the buddy's lantern, and emails the owner when they've asked for that.
// Shared by the hourly scheduler and the "Run now" button.

export function parseScheduleHour(scheduleTime) {
  const m = typeof scheduleTime === "string" ? scheduleTime.match(/(\d{1,2})/) : null;
  if (!m) return 9; // sensible default: mornings
  let hour = parseInt(m[1], 10);
  if (/pm/i.test(scheduleTime) && hour < 12) hour += 12;
  else if (/am/i.test(scheduleTime) && hour === 12) hour = 0;
  return hour;
}

export async function runBuddy({ client, entityClient, buddy, userEmail, notifyEmail }) {
  const findings = await client.asServiceRole.integrations.Core.InvokeLLM({
    model: "gemini_3_flash",
    add_context_from_internet: true,
    prompt: [
      "You are " + buddy.name + ", a helper for one person.",
      'Your job, from their note: "' + buddy.note + '"',
      "What it does: " + (buddy.what_line || ""),
      "Search the web for today and report back the 3 most useful, concrete findings for this job.",
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
    .slice(0, 3)
    .map((f) => f.trim().slice(0, 160));
  if (lines.length === 0) lines.push("Nothing new today — I will look again next time.");

  const today = new Date().toISOString().slice(0, 10);
  await entityClient.entities.Buddy.update(buddy.id, { last_result: lines, last_run_date: today });

  if (notifyEmail && typeof userEmail === "string" && userEmail.includes("@")) {
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

  return lines;
}
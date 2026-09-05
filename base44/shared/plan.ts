// Plan rules — deterministic, no AI needed. When someone rewords a card,
// these turn the plain words back into machine settings: WHEN → the daily
// schedule the hourly sweep runs on, TELLS → which channel delivers.

export function parseScheduleFromWhen(whenLine, fallback) {
  const w = typeof whenLine === "string" ? whenLine.toLowerCase() : "";
  const fb = fallback || "9:00 AM";
  let hour = null;

  if (/morning/.test(w)) hour = 9;
  else if (/noon/.test(w)) hour = 12;
  else if (/afternoon/.test(w)) hour = 14;
  else if (/evening|night/.test(w)) hour = 18;

  const at = w.match(/(?:at|by)\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/);
  if (at) {
    hour = parseInt(at[1], 10);
    if (hour < 0 || hour > 23) return fb;
    if (at[3] && /^p/.test(at[3]) && hour < 12) hour += 12;
    else if (at[3] && /^a/.test(at[3]) && hour === 12) hour = 0;
    else if (!at[3] && hour <= 7 && !/morning/.test(w)) hour += 12; // "at 3" means afternoon
  }

  if (hour === null) return fb;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return h12 + ":00 " + (hour < 12 ? "AM" : "PM");
}

// Which channel the TELLS line asks for. Unspecified (or both) → both.
export function parseDelivery(howLine) {
  const how = typeof howLine === "string" ? howLine.toLowerCase() : "";
  const saysText = /text|sms|phone|twilio/.test(how);
  const saysEmail = /email|mail|inbox/.test(how);
  if (saysText && !saysEmail) return { sms: true, email: false };
  if (saysEmail && !saysText) return { sms: false, email: true };
  return { sms: true, email: true };
}
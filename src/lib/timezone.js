// A note that says "every morning at 9" means the person's morning, not the
// server's. The account keeps the zone their browser reports so the hourly
// sweep can run each note on the right clock.

export function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch (_) {
    return "";
  }
}

// Saves the zone the first time we see it, and again if they've moved.
// Never throws — a note still runs on UTC if this doesn't get through.
export async function ensureTimezone(base44, user) {
  const tz = browserTimezone();
  if (!tz || !user || user.timezone === tz) return user;
  try {
    await base44.auth.updateMe({ timezone: tz });
    return { ...user, timezone: tz };
  } catch (_) {
    return user;
  }
}

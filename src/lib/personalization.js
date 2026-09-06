export function relevantProfileFacts(profile, text) {
  if (!profile) return [];
  const lower = String(text || "").toLowerCase();
  const facts = [];
  const add = (label, value) => {
    const v = String(value || "").trim();
    if (v) facts.push(`${label}: ${v}`);
  };
  const travel = /\b(flight|flights|airfare|airport|airline|trip|travel|hotel)\b/.test(lower);
  const local = /\b(near me|nearby|plumber|electrician|mechanic|cleaner|dentist|contractor|roofer|salon|barber|restaurant)\b/.test(lower);
  const shopping = /\b(buy|shop|shopping|price|deal|gift|product|store|under \$|cheapest)\b/.test(lower);
  if (travel) {
    add("Home", profile.home_city);
    add("Airport", profile.home_airport);
    (profile.travel_preferences || []).slice(0, 5).forEach((p) => add("Travel", p));
  }
  if (local) add("Home", profile.home_city);
  if (shopping) (profile.shopping_preferences || []).slice(0, 5).forEach((p) => add("Shopping", p));
  (profile.general_preferences || []).slice(0, 4).forEach((p) => add("Preference", p));
  return facts.slice(0, 8);
}

export function relevantProfileFacts(profile: any, text: string) {
  if (!profile) return [];
  const lower = String(text || '').toLowerCase();
  const facts: string[] = [];
  const add = (label: string, value: any) => {
    const v = String(value || '').trim();
    if (v && !facts.some((x) => x.toLowerCase() === `${label}: ${v}`.toLowerCase())) facts.push(`${label}: ${v}`);
  };

  const travel = /\b(flight|flights|airfare|airport|airline|trip|travel|hotel)\b/.test(lower);
  const local = /\b(near me|nearby|plumber|electrician|mechanic|cleaner|dentist|contractor|roofer|salon|barber|restaurant)\b/.test(lower);
  const shopping = /\b(buy|shop|shopping|price|deal|gift|product|store|under \$|cheapest)\b/.test(lower);

  if (travel) {
    add('Home city', profile.home_city);
    add('Home airport', profile.home_airport);
    for (const p of Array.isArray(profile.travel_preferences) ? profile.travel_preferences.slice(0, 8) : []) add('Travel preference', p);
  }
  if (local) add('Home city', profile.home_city);
  if (shopping) {
    for (const p of Array.isArray(profile.shopping_preferences) ? profile.shopping_preferences.slice(0, 8) : []) add('Shopping preference', p);
  }

  const people = Array.isArray(profile.people) ? profile.people : [];
  for (const person of people.slice(0, 12)) {
    const name = String(person?.name || '').trim();
    const relation = String(person?.relation || '').trim();
    if ((name && lower.includes(name.toLowerCase())) || (relation && lower.includes(relation.toLowerCase()))) {
      add(`${relation || name}`, [name && relation ? name : '', person?.notes || ''].filter(Boolean).join(' — '));
    }
  }

  for (const p of Array.isArray(profile.general_preferences) ? profile.general_preferences.slice(0, 8) : []) add('Preference', p);
  return facts.slice(0, 12);
}

export async function loadProfile(base44: any, userId: string) {
  if (!userId) return null;
  try {
    const rows = await base44.asServiceRole.entities.BuddyProfile.filter({ owner_id: userId }, '-updated_date', 1);
    return Array.isArray(rows) ? rows[0] || null : null;
  } catch (_) {
    return null;
  }
}

export async function loadHousehold(base44: any, userId: string) {
  if (!userId) return null;
  try {
    const rows = await base44.asServiceRole.entities.HouseholdProfile.filter({ owner_id: userId }, '-updated_date', 1);
    return Array.isArray(rows) ? rows[0] || null : null;
  } catch (_) {
    return null;
  }
}

export function householdFacts(household: any, text: string) {
  if (!household) return [];
  const lower = String(text || '').toLowerCase();
  const facts: string[] = [];
  const members = Array.isArray(household.members) ? household.members : [];
  for (const member of members.slice(0, 12)) {
    const name = String(member?.name || '').trim();
    const relation = String(member?.relation || '').trim();
    if ((name && lower.includes(name.toLowerCase())) || (relation && lower.includes(relation.toLowerCase()))) {
      const note = String(member?.notes || '').trim();
      facts.push(`Household: ${relation || name}${name && relation ? ` ${name}` : ''}${note ? ` — ${note}` : ''}`);
    }
  }
  if (/\b(family|household|home|everyone|we|our)\b/.test(lower)) {
    for (const p of Array.isArray(household.shared_preferences) ? household.shared_preferences.slice(0, 6) : []) facts.push(`Household preference: ${String(p).slice(0, 180)}`);
    for (const n of Array.isArray(household.shared_notes) ? household.shared_notes.slice(0, 4) : []) facts.push(`Household note: ${String(n).slice(0, 180)}`);
  }
  return facts.slice(0, 10);
}

export function profilePromptLines(profile: any, requestText: string) {
  const facts = relevantProfileFacts(profile, requestText);
  if (!facts.length) return [];
  return [
    'Relevant things this person previously asked Buddy to remember. Use only when they help this request; never override an explicit instruction in the current request:',
    ...facts.map((f) => `- ${f}`),
    'If you rely on one of these facts, do not ask for it again.'
  ];
}

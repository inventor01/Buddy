export function requestCategory(text: string, capability = 'web') {
  const lower = String(text || '').toLowerCase();
  if (capability === 'gmail' || /\b(email|gmail|inbox)\b/.test(lower)) return 'email';
  if (capability === 'calendar' || /\b(calendar|appointment|schedule)\b/.test(lower)) return 'calendar';
  if (capability === 'tasks' || /\b(tasks?|to-?do)\b/.test(lower)) return 'tasks';
  if (/\b(flight|hotel|trip|travel|airline|airport)\b/.test(lower)) return 'travel';
  if (/\b(plumber|electrician|mechanic|cleaner|contractor|roofer|salon|barber|dentist|repair|service)\b/.test(lower)) return 'home_services';
  if (/\b(buy|shopping|shop|product|store|gift|deal|price|cheapest)\b/.test(lower)) return 'shopping';
  if (/\b(family|household|mom|dad|partner|wife|husband|kid|child)\b/.test(lower)) return 'household';
  return 'general';
}

export async function loadDelegationPolicy(base44: any, userId: string, category: string) {
  if (!userId) return null;
  try {
    const exact = await base44.asServiceRole.entities.DelegationPolicy.filter({ owner_id: userId, category, enabled: true }, '-updated_date', 1);
    if (Array.isArray(exact) && exact[0]) return exact[0];
    const general = await base44.asServiceRole.entities.DelegationPolicy.filter({ owner_id: userId, category: 'general', enabled: true }, '-updated_date', 1);
    return Array.isArray(general) ? general[0] || null : null;
  } catch (_) {
    return null;
  }
}

export function delegationPromptLines(policy: any) {
  if (!policy?.level) return [];
  const explanations: Record<string, string> = {
    find: 'Research and show options only. Do not choose one for the user.',
    recommend: 'Research options and clearly recommend the best fit, with reasons.',
    prepare: 'Research, recommend, and prepare the next step, but do not change anything outside Buddy.',
    approve: 'Research, recommend, and prepare consequential next steps for explicit user approval before anything changes outside Buddy.',
    auto: 'Treat this as a preference for high autonomy, but consequential writes, purchases, payments, bookings, deletions, and commitments still require approval unless a separately enforced safety rule explicitly allows them.'
  };
  return [`Delegation preference for this category: ${policy.level}. ${explanations[policy.level] || explanations.approve}`];
}

function uniqueStrings(values: any[], max = 8, width = 240) {
  const out: string[] = [];
  for (const raw of Array.isArray(values) ? values : []) {
    const value = String(raw || '').trim().slice(0, width);
    if (value && !out.some((x) => x.toLowerCase() === value.toLowerCase())) out.push(value);
    if (out.length >= max) break;
  }
  return out;
}

export async function createReceiptOnce({ base44, buddy, summary, items = [], personalFacts = [], changesMade = [], confirmation = '', outcome = 'handled', estimatedTimeSavedMinutes = 10 }: any) {
  if (!buddy?.id || !buddy?.owner_id) return null;
  try {
    const existing = await base44.asServiceRole.entities.BuddyReceipt.filter({ owner_id: buddy.owner_id, buddy_id: buddy.id }, '-created_date', 1);
    if (Array.isArray(existing) && existing.length) return existing[0];
    const whyChosen = uniqueStrings((items || []).map((x: any) => x?.why_fit), 6, 160);
    const sourceUrls = uniqueStrings((items || []).map((x: any) => x?.url || x?.product?.url), 8, 500);
    return await base44.asServiceRole.entities.BuddyReceipt.create({
      owner_id: buddy.owner_id,
      buddy_id: buddy.id,
      title: String(buddy.name || 'Handled').slice(0, 120),
      outcome: String(outcome || 'handled').slice(0, 80),
      completed_at: new Date().toISOString(),
      category: String(buddy.capability || buddy.kind || 'general').slice(0, 80),
      summary: String(summary || '').slice(0, 1200),
      why_chosen: whyChosen,
      used_context: uniqueStrings(personalFacts, 10, 220),
      changes_made: uniqueStrings(changesMade, 10, 220),
      confirmation: String(confirmation || '').slice(0, 300),
      source_urls: sourceUrls,
      estimated_time_saved_minutes: Math.max(0, Math.min(240, Number(estimatedTimeSavedMinutes) || 0)),
    });
  } catch (_) {
    return null;
  }
}

export async function recordEscalationOnce({ base44, buddy, reason, nextStep = 'Retry this request or change the request details.' }: any) {
  if (!buddy?.id || !buddy?.owner_id) return null;
  try {
    const existing = await base44.asServiceRole.entities.BuddyEscalation.filter({ owner_id: buddy.owner_id, buddy_id: buddy.id, status: 'open' }, '-created_date', 1);
    if (Array.isArray(existing) && existing[0]) return existing[0];
    return await base44.asServiceRole.entities.BuddyEscalation.create({
      owner_id: buddy.owner_id,
      buddy_id: buddy.id,
      title: String(buddy.name || 'Needs another way').slice(0, 120),
      reason: String(reason || 'Buddy could not finish this automatically.').slice(0, 600),
      next_step: String(nextStep || '').slice(0, 300),
      status: 'open',
      created_at: new Date().toISOString(),
      resolved_at: '',
    });
  } catch (_) {
    return null;
  }
}

export async function resolveEscalation(base44: any, buddyId: string, ownerId: string) {
  if (!buddyId || !ownerId) return;
  try {
    const rows = await base44.asServiceRole.entities.BuddyEscalation.filter({ owner_id: ownerId, buddy_id: buddyId, status: 'open' }, '-created_date', 10);
    for (const row of Array.isArray(rows) ? rows : []) {
      await base44.asServiceRole.entities.BuddyEscalation.update(row.id, { status: 'resolved', resolved_at: new Date().toISOString() });
    }
  } catch (_) {}
}

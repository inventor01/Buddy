// One-per-draft token so a double-submitted plan cannot create two handoffs.
// Stable across retries of the same intent; a fresh draft gets a fresh token.

export function newClientToken() {
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'ct-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
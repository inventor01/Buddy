import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { listAdAccounts } from '../../shared/ads.ts';

// Checks the ad token the person pasted in Settings: does it work, and
// which ad accounts can it see? Doubles as the connection status check
// the Settings card runs on load.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ connected: false, error: 'Sign in first' }, { status: 401 });

    const token = typeof user.meta_token === 'string' ? user.meta_token.trim() : '';
    if (!token) return Response.json({ connected: false });

    try {
      const accounts = await listAdAccounts(token);
      if (!accounts.length) {
        return Response.json({
          connected: false,
          error: "This token can't see any ad accounts — it needs ads_read permission."
        });
      }
      // Keep the account they chose; default to the first one seen.
      if (typeof user.meta_ad_account !== 'string' || !user.meta_ad_account) {
        await base44.auth.updateMe({ meta_ad_account: 'act_' + accounts[0].account_id });
      }
      return Response.json({ connected: true, accounts });
    } catch (e) {
      return Response.json({ connected: false, error: e.message });
    }
  } catch (error) {
    return Response.json({ connected: false, error: error.message }, { status: 500 });
  }
}
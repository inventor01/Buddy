import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { listAdAccounts } from '../../shared/ads.ts';
import { listPages } from '../../shared/social.ts';

// Checks the Meta token the person pasted in Settings: does it work, and
// which ad accounts and Facebook Pages can it see? Doubles as the
// connection status check the Settings card runs on load.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ connected: false, error: 'Sign in first' }, { status: 401 });

    const token = typeof user.meta_token === 'string' ? user.meta_token.trim() : '';
    if (!token) return Response.json({ connected: false });

    // A token may carry ads permission, Pages permission, or both — one
    // failing shouldn't hide the other.
    let accounts = [];
    let pages = [];
    let firstError = '';
    try {
      accounts = await listAdAccounts(token);
    } catch (e) {
      firstError = e.message;
    }
    try {
      pages = await listPages(token);
    } catch (e) {
      firstError = firstError || e.message;
    }

    if (!accounts.length && !pages.length) {
      return Response.json({
        connected: false,
        error:
          firstError ||
          "This token can't see any ad accounts or Pages — it needs ads_read or pages_manage_posts permission."
      });
    }

    // Keep the account and Page they chose; default to the first ones seen.
    const updates = {};
    if (accounts.length && !(typeof user.meta_ad_account === 'string' && user.meta_ad_account)) {
      updates.meta_ad_account = 'act_' + accounts[0].account_id;
    }
    if (pages.length && !(typeof user.meta_page_id === 'string' && user.meta_page_id)) {
      updates.meta_page_id = pages[0].id;
    }
    if (Object.keys(updates).length) await base44.auth.updateMe(updates);

    return Response.json({ connected: true, accounts, pages });
  } catch (error) {
    return Response.json({ connected: false, error: error.message }, { status: 500 });
  }
}
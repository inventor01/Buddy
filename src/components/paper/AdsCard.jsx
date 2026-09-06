import React, { useEffect, useState } from "react";
import { Megaphone, Loader2, Check, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

// The ad accounts card — each person brings their own Meta access
// token. Once it's here, any note about ads can watch spend, follow
// rules (pause, resume, budgets), and build new ads on their behalf.
export default function AdsCard() {
  const [token, setToken] = useState("");
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState("");

  const verify = async () => {
    setChecking(true);
    setError("");
    try {
      const res = await base44.functions.invoke("adsVerify", {});
      if (res.data?.connected) {
        setAccounts(res.data.accounts || []);
      } else {
        setAccounts(null);
        if (res.data?.error) setError(res.data.error);
      }
    } catch (_) {
      setAccounts(null);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    verify();
  }, []);

  const save = async () => {
    if (!token.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await base44.auth.updateMe({ meta_token: token.trim(), meta_ad_account: "" });
      setToken("");
      await verify();
    } catch (_) {
      setError("That token didn't save — try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({ meta_token: "", meta_ad_account: "" });
      setAccounts(null);
      setError("");
    } catch (_) {
      /* leave the state as-is; they can try again */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <Megaphone className="mt-0.5 h-5 w-5 text-neutral-400" />
        <div className="flex-1">
          <h3 className="font-medium text-neutral-900">Ad accounts</h3>
          <p className="mt-0.5 text-sm text-neutral-500">
            Connect your Facebook & Instagram ads — notes can watch spend, follow your rules,
            and make new ads.
          </p>

          {accounts ? (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/70 bg-white/70 px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm text-neutral-800">
                <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                {(accounts.map((a) => a.name).join(", ") || "Ad account") + " connected"}
              </span>
              <button
                type="button"
                onClick={remove}
                disabled={saving}
                className="flex shrink-0 items-center gap-1 text-xs text-neutral-400 transition-colors hover:text-neutral-700"
              >
                <X className="h-3.5 w-3.5" /> Remove
              </button>
            </div>
          ) : (
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  type="password"
                  placeholder="Paste your Meta access token"
                  className="flex-1 rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-400"
                />
                <button
                  type="button"
                  onClick={save}
                  disabled={!token.trim() || saving}
                  className="flex items-center gap-1.5 rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-sm text-neutral-800 transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-50"
                >
                  {saving || checking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Connect
                </button>
              </div>
              {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
              <p className="mt-2 text-xs text-neutral-400">
                In Meta Business Suite → Users → System users, add a system user to your ad
                account and generate a token with ads_read, ads_management, pages_manage_ads,
                pages_show_list.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
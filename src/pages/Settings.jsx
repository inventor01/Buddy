import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, Type, Loader2, MessageCircle, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Switch } from "@/components/ui/switch";
import { readBigText, applyBigText } from "@/lib/bigText";

// Settings — notification and reading preferences, on the same light
// glass surfaces as everything else.
export default function Settings() {
  const [me, setMe] = useState(null);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [bigText, setBigText] = useState(readBigText());
  const [saving, setSaving] = useState(false);
  const [smsPhone, setSmsPhone] = useState("");
  const [phoneSaved, setPhoneSaved] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);

  useEffect(() => {
    base44
      .auth.me()
      .then((u) => {
        setMe(u);
        setNotifyEmail(!!u?.notify_email);
        setSmsPhone(u?.sms_phone || "");
      })
      .catch(() => {});
  }, []);

  const saveEmailPref = async (value) => {
    setNotifyEmail(value);
    setSaving(true);
    try {
      await base44.auth.updateMe({ notify_email: value });
    } catch (e) {
      setNotifyEmail(!value);
    } finally {
      setSaving(false);
    }
  };

  const savePhone = async () => {
    setSavingPhone(true);
    setPhoneSaved(false);
    try {
      await base44.auth.updateMe({ sms_phone: smsPhone.trim() });
      setPhoneSaved(true);
    } finally {
      setSavingPhone(false);
    }
  };

  const toggleBig = () => {
    const next = !bigText;
    setBigText(next);
    applyBigText(next);
  };

  return (
    <div className="page-glow min-h-screen">
      <div className="mx-auto max-w-xl px-5 pb-16 sm:px-8">
        <header className="flex items-center justify-between py-6">
          <Link
            to="/"
            className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-neutral-600 transition-colors hover:text-neutral-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to your notes
          </Link>
          <span className="font-semibold tracking-tight text-neutral-900">Settings</span>
        </header>

        <h1 className="mt-6 font-heading text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
          Your preferences
        </h1>
        <p className="mt-2 text-[15px] text-neutral-500">
          How your notes should reach you, and how things should read.
        </p>

        <div className="mt-8 space-y-4">
          {/* email notifications */}
          <div className="glass flex items-center justify-between gap-4 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 text-neutral-400" />
              <div>
                <h3 className="font-medium text-neutral-900">Email me the answers</h3>
                <p className="mt-0.5 text-sm text-neutral-500">
                  When a note finds something, email{me ? ` ${me.email}` : " you"} the result.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />}
              <Switch checked={notifyEmail} onCheckedChange={saveEmailPref} />
            </div>
          </div>

          {/* text message alerts */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <MessageCircle className="mt-0.5 h-5 w-5 text-neutral-400" />
              <div className="flex-1">
                <h3 className="font-medium text-neutral-900">Text me the answers</h3>
                <p className="mt-0.5 text-sm text-neutral-500">
                  When a note finds something, send it as a text message too.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={smsPhone}
                    onChange={(e) => {
                      setSmsPhone(e.target.value);
                      setPhoneSaved(false);
                    }}
                    placeholder="+1 555 123 4567"
                    inputMode="tel"
                    className="flex-1 rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-400"
                  />
                  <button
                    type="button"
                    onClick={savePhone}
                    disabled={savingPhone}
                    className="flex items-center gap-1.5 rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-sm text-neutral-800 transition-colors hover:bg-white disabled:cursor-wait"
                  >
                    {savingPhone ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : phoneSaved ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : null}
                    {phoneSaved ? "Saved" : "Save"}
                  </button>
                </div>
                <p className="mt-2 text-xs text-neutral-400">
                  Include the country code (like +1 for the US). Leave empty to turn texts off.
                </p>
              </div>
            </div>
          </div>

          {/* bigger text */}
          <div className="glass flex items-center justify-between gap-4 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <Type className="mt-0.5 h-5 w-5 text-neutral-400" />
              <div>
                <h3 className="font-medium text-neutral-900">Bigger text</h3>
                <p className="mt-0.5 text-sm text-neutral-500">
                  Makes everything a little easier to read.
                </p>
              </div>
            </div>
            <Switch checked={bigText} onCheckedChange={toggleBig} className="shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
}
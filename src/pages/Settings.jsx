import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, Type, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Switch } from "@/components/ui/switch";
import FireflyField from "@/components/buddy/FireflyField";
import { readBigText, applyBigText } from "@/lib/bigText";

// Settings — notification and reading preferences, kept in the same
// twilight garden so it feels like part of the world, not a control panel.
export default function Settings() {
  const [me, setMe] = useState(null);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [bigText, setBigText] = useState(readBigText());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44
      .auth.me()
      .then((u) => {
        setMe(u);
        setNotifyEmail(!!u?.notify_email);
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

  const toggleBig = () => {
    const next = !bigText;
    setBigText(next);
    applyBigText(next);
  };

  return (
    <div
      className="relative min-h-screen w-full overflow-x-hidden"
      style={{
        background:
          "radial-gradient(120% 80% at 50% -10%, #4a2d6e 0%, #2d1b4e 38%, #1a1033 100%)",
      }}
    >
      <FireflyField />
      <div className="relative z-10 mx-auto max-w-xl px-5 sm:px-8 pb-16">
        <header className="flex items-center justify-between py-6">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-full border border-amber-200/15 bg-white/5 px-4 py-2 text-sm text-amber-50/70 hover:text-amber-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to the garden
          </Link>
          <span className="font-semibold tracking-tight" style={{ color: "#faf3e0" }}>
            Settings
          </span>
        </header>

        <h1
          className="mt-6 text-3xl sm:text-4xl font-semibold tracking-tight"
          style={{ color: "#faf3e0", fontFamily: "'Fraunces', serif" }}
        >
          Your preferences
        </h1>
        <p className="mt-2 text-amber-50/65">
          How your buddies should reach you, and how things should read.
        </p>

        <div className="mt-8 space-y-4">
          {/* email notifications */}
          <div
            className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200/15 bg-white/[0.04] p-5 backdrop-blur-md"
          >
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-amber-300 mt-0.5" />
              <div>
                <h3 className="font-medium" style={{ color: "#faf3e0" }}>
                  Email me the answers
                </h3>
                <p className="text-sm text-amber-50/60 mt-0.5">
                  When a buddy finds something, email{me ? ` ${me.email}` : " you"} the result.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {saving && <Loader2 className="w-4 h-4 animate-spin text-amber-200/60" />}
              <Switch checked={notifyEmail} onCheckedChange={saveEmailPref} />
            </div>
          </div>

          {/* bigger text */}
          <div
            className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200/15 bg-white/[0.04] p-5 backdrop-blur-md"
          >
            <div className="flex items-start gap-3">
              <Type className="w-5 h-5 text-amber-300 mt-0.5" />
              <div>
                <h3 className="font-medium" style={{ color: "#faf3e0" }}>
                  Bigger text
                </h3>
                <p className="text-sm text-amber-50/60 mt-0.5">
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
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, Type, Loader2, MessageCircle, Check, Clock, UserRound, MapPin, Plane, ShoppingBag, ShieldCheck, UsersRound, House } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Switch } from "@/components/ui/switch";
import { readBigText, applyBigText } from "@/lib/bigText";
import { browserTimezone, ensureTimezone } from "@/lib/timezone";
import AdsCard from "@/components/paper/AdsCard";

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
  const [phoneError, setPhoneError] = useState("");
  const [abilities, setAbilities] = useState([]);
  const [connecting, setConnecting] = useState("");
  const [profile, setProfile] = useState(null);
  const [profileDraft, setProfileDraft] = useState({ display_name: "", home_city: "", home_airport: "", travel_preferences: "", shopping_preferences: "", general_preferences: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [policies, setPolicies] = useState([]);
  const [savingPolicy, setSavingPolicy] = useState("");
  const [household, setHousehold] = useState(null);
  const [householdDraft, setHouseholdDraft] = useState({ household_name: "", members: "", shared_preferences: "" });
  const [savingHousehold, setSavingHousehold] = useState(false);
  const [wholesale, setWholesale] = useState(null);
  const [wholesaleDraft, setWholesaleDraft] = useState({ default_zip: "48224", investor_arv_percent: "70", assignment_fee: "10000", repair_per_sqft: "25", comp_radius_miles: "1", comp_days_old: "180", min_discount_percent: "15" });
  const [savingWholesale, setSavingWholesale] = useState(false);

  useEffect(() => {
    base44
      .auth.me()
      .then(async (u) => {
        setMe(u);
        setNotifyEmail(!!u?.notify_email);
        try {
          const rows = await base44.entities.BuddyProfile.filter({ owner_id: u.id }, "-updated_date", 1);
          const p = Array.isArray(rows) ? rows[0] || null : null;
          setProfile(p);
          setProfileDraft({
            display_name: p?.display_name || "",
            home_city: p?.home_city || "",
            home_airport: p?.home_airport || "",
            travel_preferences: Array.isArray(p?.travel_preferences) ? p.travel_preferences.join(", ") : "",
            shopping_preferences: Array.isArray(p?.shopping_preferences) ? p.shopping_preferences.join(", ") : "",
            general_preferences: Array.isArray(p?.general_preferences) ? p.general_preferences.join(", ") : "",
          });
        } catch (_) {}
        try {
          const rows = await base44.entities.DelegationPolicy.filter({ owner_id: u.id }, "category", 20);
          setPolicies(Array.isArray(rows) ? rows : []);
        } catch (_) { setPolicies([]); }
        try {
          const rows = await base44.entities.HouseholdProfile.filter({ owner_id: u.id }, "-updated_date", 1);
          const h = Array.isArray(rows) ? rows[0] || null : null;
          setHousehold(h);
          setHouseholdDraft({
            household_name: h?.household_name || "",
            members: Array.isArray(h?.members) ? h.members.map((m) => [m.name, m.relation, m.notes].filter(Boolean).join(" | ")).join("\n") : "",
            shared_preferences: Array.isArray(h?.shared_preferences) ? h.shared_preferences.join(", ") : "",
          });
        } catch (_) {}
        try {
          const rows = await base44.entities.WholesaleProfile.filter({ owner_id: u.id }, "-updated_date", 1);
          const w = Array.isArray(rows) ? rows[0] || null : null;
          setWholesale(w);
          if (w) setWholesaleDraft({
            default_zip: w.default_zip || "48224",
            investor_arv_percent: String(Math.round((Number(w.investor_arv_percent) || 0.7) * 100)),
            assignment_fee: String(Number(w.assignment_fee) || 10000),
            repair_per_sqft: String(Number(w.repair_per_sqft) || 25),
            comp_radius_miles: String(Number(w.comp_radius_miles) || 1),
            comp_days_old: String(Number(w.comp_days_old) || 180),
            min_discount_percent: String(Number(w.min_discount_percent) || 15),
          });
        } catch (_) {}
        setNotifyEmail(!!u?.notify_email);
        setSmsPhone(u?.sms_phone || "");
        // Keep the zone current — it's the clock every note runs on.
        setMe(await ensureTimezone(base44, u));
        try {
          const res = await base44.functions.invoke("connectionSetup", {});
          setAbilities(res.data?.abilities || []);
        } catch (_) {
          setAbilities([]);
        }
      })
      .catch(() => {});
  }, []);

  const connectAbility = async (ability) => {
    if (!ability?.connectorId || connecting) return;
    setConnecting(ability.key);
    try {
      const url = await base44.connectors.connectAppUser(ability.connectorId);
      if (url) window.location.href = url;
    } catch (_) {
      setConnecting("");
    }
  };

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
    setPhoneError("");
    try {
      const raw = smsPhone.trim();
      // Normalise: digits-only → prepend +1; already has + → use as-is; empty → clear.
      const normalised = raw
        ? raw.startsWith('+')
          ? raw
          : '+1' + raw.replace(/\D/g, '')
        : '';
      setSmsPhone(normalised);
      await base44.auth.updateMe({ sms_phone: normalised });
      setPhoneSaved(true);
    } catch (e) {
      setPhoneError("That number didn't save — try again.");
    } finally {
      setSavingPhone(false);
    }
  };

  const saveProfile = async () => {
    if (!me?.id || savingProfile) return;
    setSavingProfile(true);
    setProfileSaved(false);
    const list = (value) => String(value || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12);
    const data = {
      owner_id: me.id,
      display_name: profileDraft.display_name.trim().slice(0, 60),
      home_city: profileDraft.home_city.trim().slice(0, 80),
      home_airport: profileDraft.home_airport.trim().slice(0, 40),
      travel_preferences: list(profileDraft.travel_preferences),
      shopping_preferences: list(profileDraft.shopping_preferences),
      general_preferences: list(profileDraft.general_preferences),
    };
    try {
      const saved = profile?.id
        ? await base44.entities.BuddyProfile.update(profile.id, data)
        : await base44.entities.BuddyProfile.create(data);
      setProfile(saved);
      setProfileSaved(true);
    } finally {
      setSavingProfile(false);
    }
  };

  const changeProfile = (key, value) => {
    setProfileSaved(false);
    setProfileDraft((p) => ({ ...p, [key]: value }));
  };

  const policyLevel = (category) => policies.find((p) => p.category === category)?.level || "approve";
  const savePolicy = async (category, level) => {
    if (!me?.id) return;
    setSavingPolicy(category);
    const current = policies.find((p) => p.category === category);
    const data = { owner_id: me.id, category, level, enabled: true };
    try {
      const saved = current?.id ? await base44.entities.DelegationPolicy.update(current.id, data) : await base44.entities.DelegationPolicy.create(data);
      setPolicies((prev) => [...prev.filter((p) => p.category !== category), saved]);
    } finally { setSavingPolicy(""); }
  };

  const saveHousehold = async () => {
    if (!me?.id || savingHousehold) return;
    setSavingHousehold(true);
    const members = householdDraft.members.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 12).map((line) => {
      const [name = "", relation = "", ...notes] = line.split("|").map((x) => x.trim());
      return { name: name.slice(0, 60), relation: relation.slice(0, 40), notes: notes.join(" | ").slice(0, 240) };
    }).filter((m) => m.name || m.relation);
    const data = {
      owner_id: me.id,
      household_name: householdDraft.household_name.trim().slice(0, 80),
      members,
      shared_preferences: householdDraft.shared_preferences.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12),
      shared_notes: [],
    };
    try {
      const saved = household?.id ? await base44.entities.HouseholdProfile.update(household.id, data) : await base44.entities.HouseholdProfile.create(data);
      setHousehold(saved);
    } finally { setSavingHousehold(false); }
  };

  const saveWholesale = async () => {
    if (!me?.id || savingWholesale) return;
    setSavingWholesale(true);
    const n = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
    const data = {
      owner_id: me.id,
      default_zip: wholesaleDraft.default_zip.replace(/\D/g, "").slice(0, 5),
      investor_arv_percent: Math.min(.9, Math.max(.4, n(wholesaleDraft.investor_arv_percent, 70) / 100)),
      assignment_fee: Math.max(0, n(wholesaleDraft.assignment_fee, 10000)),
      repair_per_sqft: Math.max(0, n(wholesaleDraft.repair_per_sqft, 25)),
      comp_radius_miles: Math.min(5, Math.max(.1, n(wholesaleDraft.comp_radius_miles, 1))),
      comp_days_old: Math.min(730, Math.max(30, n(wholesaleDraft.comp_days_old, 180))),
      min_discount_percent: Math.min(60, Math.max(0, n(wholesaleDraft.min_discount_percent, 15))),
      max_candidates_to_underwrite: 10,
      property_types: ["Single Family", "Multi-Family"],
    };
    try {
      const saved = wholesale?.id ? await base44.entities.WholesaleProfile.update(wholesale.id, data) : await base44.entities.WholesaleProfile.create(data);
      setWholesale(saved);
    } finally { setSavingWholesale(false); }
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
          <div className="glass rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <UserRound className="mt-0.5 h-5 w-5 text-neutral-400" />
              <div className="flex-1">
                <h3 className="font-medium text-neutral-900">What Buddy knows</h3>
                <p className="mt-0.5 text-sm leading-relaxed text-neutral-500">
                  Save the basics once so Buddy can stop asking the same questions. It only uses these when they actually help a request, and you can change them anytime.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[11px] font-medium text-neutral-500">What should Buddy call you?</span>
                    <input value={profileDraft.display_name} onChange={(e) => changeProfile("display_name", e.target.value)} placeholder="Jay" className="mt-1.5 w-full rounded-xl border border-white/70 bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-neutral-400" />
                  </label>
                  <label className="block">
                    <span className="flex items-center gap-1 text-[11px] font-medium text-neutral-500"><MapPin className="h-3 w-3" /> Home city</span>
                    <input value={profileDraft.home_city} onChange={(e) => changeProfile("home_city", e.target.value)} placeholder="Detroit, MI" className="mt-1.5 w-full rounded-xl border border-white/70 bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-neutral-400" />
                  </label>
                  <label className="block">
                    <span className="flex items-center gap-1 text-[11px] font-medium text-neutral-500"><Plane className="h-3 w-3" /> Usual airport</span>
                    <input value={profileDraft.home_airport} onChange={(e) => changeProfile("home_airport", e.target.value)} placeholder="DTW" className="mt-1.5 w-full rounded-xl border border-white/70 bg-white/70 px-3 py-2.5 text-sm uppercase outline-none focus:border-neutral-400" />
                  </label>
                  <label className="block">
                    <span className="flex items-center gap-1 text-[11px] font-medium text-neutral-500"><Plane className="h-3 w-3" /> Travel preferences</span>
                    <input value={profileDraft.travel_preferences} onChange={(e) => changeProfile("travel_preferences", e.target.value)} placeholder="nonstop, after 9 AM, avoid Spirit" className="mt-1.5 w-full rounded-xl border border-white/70 bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-neutral-400" />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="flex items-center gap-1 text-[11px] font-medium text-neutral-500"><ShoppingBag className="h-3 w-3" /> Shopping preferences</span>
                    <input value={profileDraft.shopping_preferences} onChange={(e) => changeProfile("shopping_preferences", e.target.value)} placeholder="lowest total price, Target pickup, free delivery" className="mt-1.5 w-full rounded-xl border border-white/70 bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-neutral-400" />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-[11px] font-medium text-neutral-500">Anything else Buddy should keep in mind</span>
                    <input value={profileDraft.general_preferences} onChange={(e) => changeProfile("general_preferences", e.target.value)} placeholder="prefer simple options, don't call before 9 AM" className="mt-1.5 w-full rounded-xl border border-white/70 bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-neutral-400" />
                  </label>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button type="button" onClick={saveProfile} disabled={savingProfile} className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50">
                    {savingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : profileSaved ? <Check className="h-3.5 w-3.5" /> : null}
                    {profileSaved ? "Saved" : "Save what Buddy knows"}
                  </button>
                  <span className="text-[11.5px] text-neutral-400">Comma-separate multiple preferences.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-neutral-400" />
              <div className="flex-1">
                <h3 className="font-medium text-neutral-900">How far Buddy should go</h3>
                <p className="mt-0.5 text-sm leading-relaxed text-neutral-500">Choose the default level of help by area. Anything that sends, books, pays, buys, deletes, or commits still asks before it happens.</p>
                <div className="mt-4 space-y-2">
                  {[["general","Everyday things"],["travel","Travel"],["shopping","Shopping"],["home_services","Home services"]].map(([category,label]) => (
                    <div key={category} className="flex items-center justify-between gap-3 rounded-xl border border-white/70 bg-white/55 px-3 py-2.5">
                      <span className="text-[13px] font-medium text-neutral-800">{label}</span>
                      <select value={policyLevel(category)} disabled={savingPolicy === category} onChange={(e) => savePolicy(category, e.target.value)} className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[12px] text-neutral-700 outline-none">
                        <option value="find">Find only</option>
                        <option value="recommend">Recommend</option>
                        <option value="prepare">Prepare next step</option>
                        <option value="approve">Ask me before doing it</option>
                        <option value="auto">Handle as much as safely allowed</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <UsersRound className="mt-0.5 h-5 w-5 text-neutral-400" />
              <div className="flex-1">
                <h3 className="font-medium text-neutral-900">Your household</h3>
                <p className="mt-0.5 text-sm text-neutral-500">Give Buddy the people and shared preferences that make family requests easier. You stay in control of what is saved.</p>
                <input value={householdDraft.household_name} onChange={(e) => setHouseholdDraft((h) => ({...h, household_name:e.target.value}))} placeholder="The Smith family" className="mt-3 w-full rounded-xl border border-white/70 bg-white/70 px-3 py-2.5 text-sm outline-none" />
                <textarea value={householdDraft.members} onChange={(e) => setHouseholdDraft((h) => ({...h, members:e.target.value}))} rows={3} placeholder={"Mom | mom | likes gardening and mystery books\nMia | daughter | dentist after 3:30 PM"} className="mt-2 w-full resize-none rounded-xl border border-white/70 bg-white/70 px-3 py-2.5 text-sm outline-none" />
                <input value={householdDraft.shared_preferences} onChange={(e) => setHouseholdDraft((h) => ({...h, shared_preferences:e.target.value}))} placeholder="weeknight appointments after 4 PM, groceries under $150" className="mt-2 w-full rounded-xl border border-white/70 bg-white/70 px-3 py-2.5 text-sm outline-none" />
                <button type="button" onClick={saveHousehold} disabled={savingHousehold} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50">{savingHousehold && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Save household</button>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <House className="mt-0.5 h-5 w-5 text-neutral-400" />
              <div className="flex-1">
                <h3 className="font-medium text-neutral-900">Wholesale deal rules</h3>
                <p className="mt-0.5 text-sm leading-relaxed text-neutral-500">When you ask Buddy to find distressed properties, these are the screening assumptions it uses. ARV comes from live comps; repairs stay a clearly labeled screening allowance until you verify the property.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    ["default_zip", "Default ZIP", "48224"],
                    ["investor_arv_percent", "Flipper buy % of ARV", "70"],
                    ["assignment_fee", "Assignment target ($)", "10000"],
                    ["repair_per_sqft", "Repair allowance ($/sq ft)", "25"],
                    ["comp_radius_miles", "Comp radius (miles)", "1"],
                    ["comp_days_old", "Comp lookback (days)", "180"],
                    ["min_discount_percent", "Minimum discount vs ARV (%)", "15"],
                  ].map(([key, label, placeholder]) => (
                    <label key={key} className="block">
                      <span className="text-[11px] font-medium text-neutral-500">{label}</span>
                      <input value={wholesaleDraft[key]} onChange={(e) => setWholesaleDraft((w) => ({ ...w, [key]: e.target.value }))} placeholder={placeholder} inputMode="decimal" className="mt-1.5 w-full rounded-xl border border-white/70 bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-neutral-400" />
                    </label>
                  ))}
                </div>
                <button type="button" onClick={saveWholesale} disabled={savingWholesale} className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50">{savingWholesale && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Save wholesale rules</button>
                <p className="mt-2 text-[10.5px] leading-relaxed text-neutral-400">Screening only—not an appraisal, repair estimate, title review, legal review, or offer recommendation. Verify the property and local wholesaling requirements before committing money.</p>
              </div>
            </div>
          </div>

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
                {phoneError && <p className="mt-2 text-xs text-red-600">{phoneError}</p>}
                <p className="mt-2 text-xs text-neutral-400">
                  Include the country code (like +1 for the US). Leave empty to turn texts off.
                </p>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <div>
              <h3 className="font-medium text-neutral-900">Things Buddy can reach for you</h3>
              <p className="mt-0.5 text-sm text-neutral-500">
                Connect only what you want Buddy to use. Sending or changing anything still asks for your approval first.
              </p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {[
                ["gmail", "Email", "Read or send email when you ask"],
                ["calendar", "Calendar", "Check or add plans when you ask"],
                ["tasks", "Tasks", "Add things you want remembered"],
              ].map(([key, label, desc]) => {
                const ability = abilities.find((a) => a.key === key);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!ability?.ready || connecting === key}
                    onClick={() => connectAbility(ability)}
                    className="rounded-xl border border-white/70 bg-white/60 p-3 text-left transition-colors hover:bg-white disabled:cursor-default disabled:opacity-60"
                  >
                    <p className="text-sm font-medium text-neutral-900">{label}</p>
                    <p className="mt-1 text-xs leading-snug text-neutral-500">{desc}</p>
                    <p className="mt-2 text-[11px] font-medium text-neutral-500">
                      {connecting === key ? "Opening…" : ability?.ready ? "Connect" : "Almost ready"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ad accounts — each person pastes their own token */}
          <AdsCard />

          {/* the clock notes run on */}
          <div className="glass flex items-center justify-between gap-4 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 text-neutral-400" />
              <div>
                <h3 className="font-medium text-neutral-900">Your clock</h3>
                <p className="mt-0.5 text-sm text-neutral-500">
                  A note set for the morning runs on your time, not ours.
                </p>
              </div>
            </div>
            <span className="shrink-0 font-mono text-[11px] text-neutral-500">
              {me?.timezone || browserTimezone() || "UTC"}
            </span>
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
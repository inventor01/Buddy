import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShoppingBag, Store, Cake, Pill, ArrowDown, Loader2, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import FireflyField from "@/components/buddy/FireflyField";
import NoteComposer from "@/components/buddy/NoteComposer";
import BuddyCard from "@/components/buddy/BuddyCard";
import BuddyCreature from "@/components/buddy/BuddyCreature";
import { readBigText, applyBigText } from "@/lib/bigText";

// The buddy garden — a twilight world where your note hatches a helper
// creature that runs your errand and pins the answer back to you.
const HELPERS = [
  { icon: ShoppingBag, label: "Shopping Sam", variant: "sam" },
  { icon: Store, label: "Storefront Sid", variant: "sid" },
  { icon: Cake, label: "Birthday Bells", variant: "bells" },
  { icon: Pill, label: "Med Mate", variant: "med" },
];

const STEPS = [
  { n: "01", title: "When it happens", body: "Pick a time, or just say “every morning.”" },
  { n: "02", title: "What it does", body: "Your buddy goes off and runs the errand." },
  { n: "03", title: "How it tells you", body: "It pins the answer back — by text or email." },
];

export default function Home() {
  const { toast } = useToast();
  const [buddies, setBuddies] = useState(null); // null = still loading
  const [bigText, setBigText] = useState(readBigText());

  const loadBuddies = useCallback(async () => {
    try {
      const user = await base44.auth.me();
      const list = await base44.entities.Buddy.filter(
        { created_by_id: user.id },
        "-created_date",
        50
      );
      setBuddies(list);
    } catch (e) {
      setBuddies([]);
    }
  }, []);

  useEffect(() => {
    applyBigText(readBigText());
    loadBuddies();
  }, [loadBuddies]);

  const toggleBigText = () => {
    const next = !bigText;
    setBigText(next);
    applyBigText(next);
  };

  const handlePin = async (note) => {
    try {
      const res = await base44.functions.invoke("createBuddyFromNote", { note });
      const plan = res.data?.plan;
      if (!plan) throw new Error("The buddy didn't hatch — try again.");
      const created = await base44.entities.Buddy.create({ note, ...plan, status: "active" });
      setBuddies((prev) => [created, ...(prev ?? [])]);
    } catch (e) {
      toast({
        title: e.message || "Couldn't hatch that buddy — try again.",
        variant: "destructive",
      });
      throw e;
    }
  };

  const togglePause = async (b) => {
    const status = b.status === "paused" ? "active" : "paused";
    await base44.entities.Buddy.update(b.id, { status });
    setBuddies((prev) => prev.map((x) => (x.id === b.id ? { ...x, status } : x)));
  };

  const takeDown = async (b) => {
    await base44.entities.Buddy.delete(b.id);
    setBuddies((prev) => prev.filter((x) => x.id !== b.id));
  };

  const runNow = async (b) => {
    try {
      const res = await base44.functions.invoke("runBuddyNow", { buddyId: b.id });
      const lines = res.data?.lines || [];
      setBuddies((prev) => prev.map((x) => (x.id === b.id ? { ...x, last_result: lines } : x)));
    } catch (e) {
      toast({ title: e.message || "That run didn't finish — try again.", variant: "destructive" });
      throw e;
    }
  };

  const signOut = () => base44.auth.logout("/login");

  const navItems = [
    { label: "Home", to: "/" },
    { label: "Settings", to: "/settings" },
  ];

  return (
    <div
      className="relative min-h-screen w-full overflow-x-hidden"
      style={{
        background:
          "radial-gradient(120% 80% at 50% -10%, #4a2d6e 0%, #2d1b4e 38%, #1a1033 100%)",
      }}
    >
      <FireflyField />

      {/* soft horizon glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 h-1/2"
        style={{
          background:
            "radial-gradient(100% 100% at 50% 120%, rgba(231,111,81,0.28), transparent 60%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-5xl px-5 sm:px-8">
        {/* Header */}
        <header className="flex items-center justify-between py-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="grid place-items-center w-8 h-8 rounded-full bg-amber-300 text-stone-900 font-bold text-sm shadow-[0_0_18px_#ffd29c88]">
              ab
            </div>
            <span className="font-semibold tracking-tight" style={{ color: "#faf3e0" }}>
              Agent Buddy
            </span>
          </Link>
          <nav className="flex items-center gap-1 rounded-full border border-amber-200/15 bg-white/5 p-1 backdrop-blur-md">
            {navItems.map(({ label, to }) => (
              <Link
                key={label}
                to={to}
                className={`rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm transition-colors ${
                  label === "Home"
                    ? "bg-amber-300/90 text-stone-900 font-semibold"
                    : "text-amber-50/70 hover:text-amber-50"
                }`}
              >
                {label}
              </Link>
            ))}
            <button
              type="button"
              onClick={toggleBigText}
              className={`rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm transition-colors ${
                bigText
                  ? "bg-amber-300/90 text-stone-900 font-semibold"
                  : "text-amber-50/70 hover:text-amber-50"
              }`}
            >
              Bigger text
            </button>
            <button
              type="button"
              onClick={signOut}
              className="rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm text-amber-50/70 hover:text-amber-50 transition-colors"
            >
              Sign out
            </button>
          </nav>
        </header>

        {/* Hero */}
        <section className="pt-10 sm:pt-16 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.05]"
            style={{ color: "#faf3e0", fontFamily: "'Fraunces', serif" }}
          >
            Leave it a note.
            <br />
            <span style={{ color: "#ffd29c" }}>It does the errand.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mx-auto mt-5 max-w-md text-base sm:text-lg text-amber-50/70"
          >
            Write it the way you'd write it on the fridge. It goes off, has a
            look, and pins the answer back to you.
          </motion.p>

          <div className="mt-10">
            <NoteComposer onPin={handlePin} />
          </div>

          {/* "it goes" connector */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="my-8 flex flex-col items-center gap-2 text-amber-200/60"
          >
            <ArrowDown className="w-5 h-5 animate-bounce" />
            <span className="rounded-full border border-amber-200/20 bg-white/5 px-3 py-1 text-xs tracking-wide">
              it goes
            </span>
          </motion.div>
        </section>

        {/* Buddy habitat */}
        <section className="pb-4">
          {buddies === null ? (
            <div className="flex items-center justify-center gap-2 py-14 text-amber-100/60">
              <Loader2 className="w-4 h-4 animate-spin" /> Waking the garden…
            </div>
          ) : buddies.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-14 text-center">
              <BuddyCreature variant="bells" size={84} active={false} />
              <p className="flex items-center gap-1.5 text-amber-100/70">
                <Sparkles className="w-4 h-4 text-amber-300" />
                Your helpers will show up here once you make your first one.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {buddies.map((b) => (
                <BuddyCard key={b.id} buddy={b} onPause={togglePause} onTakeDown={takeDown} onRun={runNow} />
              ))}
            </div>
          )}
        </section>

        {/* Helper pills */}
        <section className="py-10">
          <p className="text-center text-xs uppercase tracking-[0.25em] text-amber-200/50 mb-5">
            Kinds of buddies
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {HELPERS.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-full border border-amber-200/15 bg-white/5 px-4 py-2 backdrop-blur-md"
              >
                <Icon className="w-4 h-4 text-amber-300" />
                <span className="text-sm text-amber-50/80">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* How it works — three plain lines */}
        <section className="py-12">
          <p className="text-center text-amber-50/70 max-w-md mx-auto">
            Every note shows you three plain lines before it starts — when it
            happens, what it does, and how it tells you. Take a note down any
            time.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="rounded-2xl border border-amber-200/12 bg-white/[0.04] p-5 backdrop-blur-md"
              >
                <div className="text-amber-300/60 text-xs font-mono">{s.n}</div>
                <h4 className="mt-2 font-semibold" style={{ color: "#faf3e0" }}>
                  {s.title}
                </h4>
                <p className="mt-1 text-sm text-amber-50/65">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 text-center">
          <p className="text-amber-200/50 text-sm">Made to be simple enough for anyone.</p>
        </footer>
      </div>
    </div>
  );
}
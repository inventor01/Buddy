import React, { useState } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, Store, Cake, Pill, ArrowDown } from "lucide-react";
import FireflyField from "@/components/buddy/FireflyField";
import NoteComposer from "@/components/buddy/NoteComposer";
import BuddyCard from "@/components/buddy/BuddyCard";

// The buddy garden — a twilight world where your note hatches a helper
// creature that runs your errand and pins the answer back to you.
const BUDDIES = [
  {
    name: "Shopping Sam",
    variant: "sam",
    time: "9:00 AM",
    pinnedAt: "9:02 AM",
    status: "done",
    lines: ["Every morning at 9", "Finds your store's best coupons", "Pins them back here"],
    result: ["$2 off eggs · code EGG2", "BOGO coffee · in store", "15% off produce · FRESH15"],
  },
  {
    name: "Birthday Bells",
    variant: "bells",
    time: "8:00 AM",
    status: "running",
    lines: ["Every morning at 8", "Checks who needs a birthday text", "Sends it a week early"],
  },
];

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
  const [extra, setExtra] = useState(null);

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
          <div className="flex items-center gap-2.5">
            <div className="grid place-items-center w-8 h-8 rounded-full bg-amber-300 text-stone-900 font-bold text-sm shadow-[0_0_18px_#ffd29c88]">
              ab
            </div>
            <span className="text-cream font-semibold tracking-tight" style={{ color: "#faf3e0" }}>
              Agent Buddy
            </span>
          </div>
          <nav className="flex items-center gap-1 rounded-full border border-amber-200/15 bg-white/5 p-1 backdrop-blur-md">
            {["Home", "Settings", "Bigger text", "Sign in"].map((item, i) => (
              <button
                key={item}
                className={`rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm transition-colors ${
                  i === 0
                    ? "bg-amber-300/90 text-stone-900 font-semibold"
                    : "text-amber-50/70 hover:text-amber-50"
                }`}
              >
                {item}
              </button>
            ))}
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
            <NoteComposer onPin={() => setExtra({ hatched: true })} />
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
          <div className="grid gap-5 sm:grid-cols-2">
            {BUDDIES.map((b) => (
              <BuddyCard key={b.name} buddy={b} />
            ))}
            {extra?.hatched && (
              <BuddyCard
                buddy={{
                  name: "Your new buddy",
                  variant: "sid",
                  time: "tomorrow",
                  status: "running",
                  lines: ["Just hatched", "Reading your note", "Getting ready to run"],
                }}
              />
            )}
          </div>
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
                <h4 className="mt-2 text-cream font-semibold" style={{ color: "#faf3e0" }}>
                  {s.title}
                </h4>
                <p className="mt-1 text-sm text-amber-50/65">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 text-center">
          <p className="text-amber-200/50 text-sm">
            Made to be simple enough for anyone.
          </p>
        </footer>
      </div>
    </div>
  );
}
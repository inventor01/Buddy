import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

// "Here's what we found" — the payoff moment. Every finding rises into
// place one by one over a breathing emerald glow, buttons respond with a
// spring, and phones give a tiny buzz when the answer lands or is tapped.

const buzz = (pattern) => {
  try {
    navigator.vibrate?.(pattern);
  } catch (_) {
    /* haptics aren't supported here — no harm done */
  }
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.11, delayChildren: 0.08 } },
};

const rise = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

export default function FoundIt({ result, onContinue, onRestart }) {
  const lines = (result?.text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // A little buzz the moment the findings appear.
  useEffect(() => {
    buzz(20);
  }, []);

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="glass rounded-[24px] p-6 sm:p-8"
    >
      <motion.p variants={rise} className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
        Just ran it
      </motion.p>

      <motion.h2
        variants={rise}
        className="mt-3 font-heading text-[26px] font-semibold tracking-tight text-neutral-900 sm:text-[30px]"
      >
        Here's what we found, right now.
      </motion.h2>
      <motion.p variants={rise} className="mt-2 text-[14px] text-neutral-500">
        This is the real thing — not a demo.
      </motion.p>

      {/* the findings, over a breathing emerald glow */}
      <div className="relative mt-6">
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-6 rounded-[28px]"
          style={{
            background: "radial-gradient(60% 60% at 30% 40%, rgba(16,185,129,.22) 0%, rgba(16,185,129,0) 70%)",
          }}
          animate={{ opacity: [0.45, 0.9, 0.45], scale: [0.97, 1.03, 0.97] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          variants={rise}
          className="relative rounded-2xl border border-white/70 bg-white/75 p-5 backdrop-blur-xl"
          style={{ borderLeft: "4px solid #10B981" }}
        >
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
            What we found · just now{lines.length > 1 ? ` · ${lines.length} things` : ""}
          </p>
          <div className="mt-2.5 space-y-2.5">
            {lines.map((line, i) => (
              <motion.div key={i} variants={rise} className="flex items-start gap-2.5">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <p className="text-[15.5px] leading-snug text-neutral-900">{line}</p>
              </motion.div>
            ))}
          </div>
          {result.source && <p className="mt-3 text-[12px] text-neutral-500">{result.source}</p>}
        </motion.div>
      </div>

      <motion.p
        variants={rise}
        className="mt-4 rounded-2xl border border-dashed border-neutral-300 p-5 text-[14px] text-neutral-500"
      >
        From tomorrow, this arrives as one text — and only when there's something worth saying.
      </motion.p>

      <motion.div variants={rise} className="mt-7 flex flex-wrap items-center gap-4">
        <motion.button
          type="button"
          onClick={() => {
            buzz(14);
            onContinue();
          }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
          className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-[14px] font-medium text-white hover:bg-neutral-800"
        >
          <ArrowRight className="h-4 w-4" /> Set it going
        </motion.button>
        <motion.button
          type="button"
          onClick={() => {
            buzz(8);
            onRestart();
          }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="text-[13.5px] font-medium text-neutral-500 hover:text-neutral-800"
        >
          Try different words
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
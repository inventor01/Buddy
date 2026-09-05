import React from "react";
import { motion } from "framer-motion";
import { Volume2, Check } from "lucide-react";
import BuddyCreature from "./BuddyCreature";

// A buddy's lantern — the creature lives here, bobs while it works, and
// pins its findings back onto a little note tucked underneath.
export default function BuddyCard({ buddy }) {
  const { name, variant, time, status, pinnedAt, lines = [], result } = buddy;
  const running = status === "running";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative rounded-[1.6rem] p-5 backdrop-blur-md"
      style={{
        background: "linear-gradient(165deg, rgba(255,253,246,0.10), rgba(255,246,230,0.04))",
        border: "1px solid rgba(255,217,160,0.22)",
        boxShadow: running
          ? "0 0 36px -6px #ffd29c55, inset 0 0 24px -10px #ffd29c44"
          : "0 14px 40px -22px #00000099",
      }}
    >
      {/* header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BuddyCreature variant={variant} size={64} active={running} />
          <div>
            <h3 className="text-cream font-semibold text-lg" style={{ color: "#faf3e0" }}>
              {name}
            </h3>
            <p className="text-xs text-amber-100/60">
              {pinnedAt ? `pinned this at ${pinnedAt}` : `every ${time}`}
            </p>
          </div>
        </div>
        {running && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
            <motion.span
              className="w-1.5 h-1.5 rounded-full bg-emerald-300"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
            Running
          </span>
        )}
        {!running && (
          <span className="flex items-center gap-1 rounded-full bg-amber-300/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200/80">
            <Check className="w-3 h-3" /> Done
          </span>
        )}
      </div>

      {/* the three plain lines (when/what/how) */}
      {lines.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {lines.map((l, i) => (
            <li key={i} className="flex gap-2 text-sm text-amber-50/75">
              <span className="text-amber-300/70 mt-0.5">—</span>
              <span>{l}</span>
            </li>
          ))}
        </ul>
      )}

      {/* pinned result note */}
      {result && (
        <div
          className="mt-4 rounded-2xl p-4"
          style={{
            background: "linear-gradient(160deg,#fffdf6,#fff3d6)",
            boxShadow: "0 10px 24px -14px #00000088",
          }}
        >
          <div className="space-y-2">
            {result.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl bg-stone-900/[0.04] px-3 py-2 text-sm text-stone-700"
              >
                <span>{r}</span>
              </div>
            ))}
          </div>
          <button className="mt-3 flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-800 transition-colors">
            <Volume2 className="w-3.5 h-3.5" /> Read it to me
          </button>
        </div>
      )}
    </motion.div>
  );
}
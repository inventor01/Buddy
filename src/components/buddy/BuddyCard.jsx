import React from "react";
import { motion } from "framer-motion";
import { Volume2, Pause, Play, Trash2 } from "lucide-react";
import BuddyCreature from "./BuddyCreature";

// A buddy's lantern — the creature lives here, bobs while it works, shows
// the note it was born from, its three plain lines, and its latest findings.
// Every buddy can be paused or taken down at any time.
export default function BuddyCard({ buddy, onPause, onTakeDown }) {
  const { name, creature, note, status, when_line, what_line, how_line, last_result } = buddy;
  const active = status !== "paused";

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
        boxShadow: active
          ? "0 0 36px -6px #ffd29c55, inset 0 0 24px -10px #ffd29c44"
          : "0 14px 40px -22px #00000099",
      }}
    >
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <BuddyCreature variant={creature} size={64} active={active} />
          <div className="min-w-0">
            <h3 className="font-semibold text-lg truncate" style={{ color: "#faf3e0" }}>
              {name}
            </h3>
            <p className="text-xs text-amber-100/60">every {buddy.schedule_time}</p>
          </div>
        </div>
        {active ? (
          <span className="flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 shrink-0">
            <motion.span
              className="w-1.5 h-1.5 rounded-full bg-emerald-300"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
            Running
          </span>
        ) : (
          <span className="rounded-full bg-amber-300/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200/80 shrink-0">
            Paused
          </span>
        )}
      </div>

      {/* the note it was born from */}
      {note && (
        <p
          className="mt-4 text-lg leading-snug text-amber-100/85"
          style={{ fontFamily: "'Caveat', cursive" }}
        >
          “{note}”
        </p>
      )}

      {/* the three plain lines (when/what/how) */}
      <ul className="mt-3 space-y-1.5">
        {[when_line, what_line, how_line].filter(Boolean).map((l, i) => (
          <li key={i} className="flex gap-2 text-sm text-amber-50/75">
            <span className="text-amber-300/70 mt-0.5">—</span>
            <span>{l}</span>
          </li>
        ))}
      </ul>

      {/* latest findings pinned back */}
      {Array.isArray(last_result) && last_result.length > 0 && (
        <div
          className="mt-4 rounded-2xl p-4"
          style={{
            background: "linear-gradient(160deg,#fffdf6,#fff3d6)",
            boxShadow: "0 10px 24px -14px #00000088",
          }}
        >
          <div className="space-y-2">
            {last_result.map((r, i) => (
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

      {/* actions */}
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPause(buddy)}
          className="flex items-center gap-1.5 rounded-full border border-amber-200/15 bg-white/5 px-3 py-1.5 text-xs text-amber-50/70 hover:text-amber-50 transition-colors"
        >
          {active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {active ? "Pause" : "Resume"}
        </button>
        <button
          type="button"
          onClick={() => onTakeDown(buddy)}
          className="flex items-center gap-1.5 rounded-full border border-red-300/15 bg-red-500/5 px-3 py-1.5 text-xs text-red-200/70 hover:text-red-200 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Take down
        </button>
      </div>
    </motion.div>
  );
}
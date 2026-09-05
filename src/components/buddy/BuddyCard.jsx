import React, { useState } from "react";
import { motion } from "framer-motion";
import { Volume2, Pause, Play, Trash2, Zap, Loader2 } from "lucide-react";
import BuddyCreature from "./BuddyCreature";

// A buddy's lantern — the creature lives here, bobs while it works, shows
// the note it was born from, its three plain lines, and its latest findings.
// Every buddy can be paused or taken down at any time.
export default function BuddyCard({ buddy, onPause, onTakeDown, onRun }) {
  const { name, creature, note, status, when_line, what_line, how_line, last_result } = buddy;
  const active = status !== "paused";
  const [busy, setBusy] = useState(false);

  const handleRun = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onRun(buddy);
    } catch (e) {
      /* the page already showed the error toast */
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative rounded-3xl p-6 backdrop-blur-md"
      style={{
        background: "rgba(255,253,246,0.055)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: active
          ? "0 24px 60px -32px #000, 0 0 28px -12px #ffd29c40"
          : "0 24px 60px -32px #000",
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
          className="mt-5 text-lg leading-snug text-amber-100/85"
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
          className="mt-5 rounded-2xl p-4"
          style={{
            background: "#fffdf6",
            border: "1px solid rgba(120,90,40,0.10)",
            boxShadow: "0 12px 32px -20px #000",
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
      <div className="mt-5 flex items-center gap-2">
        <button
          type="button"
          onClick={handleRun}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-full bg-amber-200/90 px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-amber-200 transition-colors disabled:cursor-wait"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          {busy ? "Running…" : "Run now"}
        </button>
        <button
          type="button"
          onClick={() => onPause(buddy)}
          className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3.5 py-1.5 text-xs text-amber-50/70 hover:text-amber-50 hover:bg-white/[0.10] transition-colors"
        >
          {active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {active ? "Pause" : "Resume"}
        </button>
        <button
          type="button"
          onClick={() => onTakeDown(buddy)}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-red-200/45 hover:text-red-200 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Take down
        </button>
      </div>
    </motion.div>
  );
}
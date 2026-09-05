import React, { useState } from "react";
import { motion } from "framer-motion";
import { Mic, Sparkles, Pin } from "lucide-react";

// The glowing paper lantern where you leave your note. One plain sentence
// is all it takes — the lantern glows brighter as you write, and the pin
// button hatches your buddy (the note is kept if hatching fails).
export default function NoteComposer({ onPin }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const glow = Math.min(0.25 + note.length / 180, 0.85);

  const handlePin = async () => {
    if (busy || !note.trim()) return;
    setBusy(true);
    try {
      await onPin(note);
      setNote("");
    } catch (e) {
      /* keep the note so they can retry */
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div className="relative w-full max-w-md mx-auto">
      {/* warm halo behind the lantern */}
      <div
        className="absolute -inset-6 rounded-[2rem] blur-2xl transition-opacity duration-500"
        style={{
          background: "radial-gradient(circle at 50% 40%, #ffd29c88, transparent 70%)",
          opacity: glow,
        }}
      />
      <div
        className="relative rounded-[1.75rem] p-6 sm:p-7 backdrop-blur-md"
        style={{
          background: "linear-gradient(160deg, #fffdf6 0%, #fff6e6 100%)",
          border: "1px solid #f0d9a8",
          boxShadow: `0 18px 50px -18px #00000055, 0 0 ${30 * glow}px ${10 * glow}px #ffd29c${Math.round(glow * 120).toString(16).padStart(2, "0")}`,
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] tracking-[0.2em] uppercase text-amber-700/70 font-semibold">
            Your note
          </span>
          <span className="h-px flex-1 bg-amber-300/50" />
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="Send me Kroger's best coupons every morning at 9"
          className="w-full resize-none bg-transparent outline-none text-xl sm:text-2xl leading-snug text-stone-800 placeholder:text-stone-400/70"
          style={{ fontFamily: "'Caveat', cursive" }}
        />

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-amber-700 transition-colors"
          >
            <Mic className="w-4 h-4" />
            <span style={{ fontFamily: "'Caveat', cursive" }} className="text-lg">or say it</span>
          </button>

          <motion.button
            type="button"
            onClick={handlePin}
            disabled={busy}
            whileTap={{ scale: 0.94 }}
            className="flex items-center gap-2 rounded-full pl-4 pr-5 py-2 text-sm font-semibold text-stone-800 transition-colors disabled:cursor-wait"
            style={{
              background: note.trim() ? "linear-gradient(180deg,#ffe9b8,#f4a261)" : "#f0e3cc",
              boxShadow: note.trim() ? "0 6px 18px -6px #f4a261aa" : "none",
            }}
          >
            {busy ? (
              <>
                <Sparkles className="w-4 h-4 animate-pulse" /> Hatching…
              </>
            ) : (
              <>
                <Pin className="w-4 h-4" /> Pin it up
              </>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
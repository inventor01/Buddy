import React, { useState } from "react";
import { motion } from "framer-motion";
import { Mic, Sparkles, Pin } from "lucide-react";

// The glowing paper lantern where you leave your note. One plain sentence
// is all it takes — the lantern glows brighter as you write, and the pin
// button hatches your buddy (the note is kept if hatching fails).
const BUDDY_REQUEST_MAX = 8000;

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
        className="relative rounded-3xl p-6 sm:p-7 backdrop-blur-md"
        style={{
          background: "#fffdf6",
          border: "1px solid rgba(240,217,168,0.55)",
          boxShadow: `0 24px 60px -28px rgba(0,0,0,0.4), 0 0 ${24 * glow}px rgba(255,210,156,${(glow * 0.35).toFixed(2)})`,
        }}
      >
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={BUDDY_REQUEST_MAX}
          placeholder="Send me Kroger's best coupons every morning at 9"
          className="w-full resize-none bg-transparent outline-none text-xl sm:text-2xl leading-snug text-stone-800 placeholder:text-stone-400/70"
          style={{ fontFamily: "'Caveat', cursive" }}
        />

        <div className="mt-2 text-right text-[10px] tabular-nums text-stone-400">
          {note.length.toLocaleString()}/{BUDDY_REQUEST_MAX.toLocaleString()}
        </div>

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
            className="flex items-center gap-2 rounded-full pl-4 pr-5 py-2 text-sm font-semibold text-stone-900 transition-colors disabled:cursor-wait"
            style={{
              background: note.trim() ? "#f4a261" : "#efe5d3",
              boxShadow: note.trim() ? "0 8px 20px -8px #f4a26199" : "none",
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
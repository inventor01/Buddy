import React, { useRef, useState } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";

// Slide-to-continue — the friendliest "next" there is. Drag the gold knob
// across the track, or just tap the track. It springs back after.
export default function SlideToContinue({ label, onDone, disabled = false, busy = false, className = "" }) {
  const trackRef = useRef(null);
  const x = useMotionValue(0);
  const [lit, setLit] = useState(false);

  const fire = () => {
    if (disabled || busy) return;
    onDone();
  };

  const snapped = () => {
    animate(x, 0, { type: "spring", stiffness: 380, damping: 38 });
    setLit(false);
  };

  const reachedEnd = () => {
    const track = trackRef.current;
    if (!track) return false;
    return x.get() > (track.offsetWidth - 64) * 0.75;
  };

  return (
    <div
      ref={trackRef}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={fire}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fire()}
      className={`relative h-14 w-full select-none overflow-hidden rounded-full border border-hairline ${
        disabled ? "cursor-not-allowed" : "cursor-pointer"
      } ${className}`}
      style={{ background: disabled ? "rgba(60,45,25,.04)" : "#FAF6ED", opacity: disabled ? 0.55 : 1 }}
    >
      <span
        className="pointer-events-none absolute inset-0 grid place-items-center text-center text-[13.5px] font-semibold"
        style={{ color: disabled ? "rgba(60,45,25,.4)" : "rgba(60,45,25,.55)" }}
      >
        {label}
      </span>
      <motion.div
        drag={disabled || busy ? false : "x"}
        dragConstraints={trackRef}
        dragElastic={0.08}
        dragMomentum={false}
        onDrag={() => setLit(reachedEnd())}
        onDragEnd={() => {
          if (reachedEnd()) fire();
          snapped();
        }}
        whileTap={{ scale: 0.96 }}
        className="absolute left-1 top-1 flex h-12 w-12 items-center justify-center rounded-full"
        style={{
          x,
          background: "var(--amber-cta)",
          color: "#2b1d0e",
          boxShadow: lit ? "0 0 0 8px rgba(232,163,61,.25)" : "0 4px 12px -4px rgba(60,45,25,.35)",
        }}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
      </motion.div>
    </div>
  );
}
import React, { useMemo } from "react";
import { motion } from "framer-motion";

// A field of slow, drifting fireflies that give the garden its ambient glow.
// Purely decorative — pointer-events disabled so it never blocks the UI.
export default function FireflyField({ count = 26 }) {
  const flies = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 2 + Math.random() * 3.5,
        delay: Math.random() * 8,
        duration: 7 + Math.random() * 9,
        drift: 18 + Math.random() * 40,
        hue: Math.random() > 0.5 ? "#ffd9a0" : "#ffe9b8",
      })),
    [count]
  );

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {flies.map((f) => (
        <motion.span
          key={f.id}
          className="absolute rounded-full"
          style={{
            left: `${f.left}%`,
            top: `${f.top}%`,
            width: f.size,
            height: f.size,
            background: f.hue,
            boxShadow: `0 0 ${f.size * 3}px ${f.size}px ${f.hue}66, 0 0 ${f.size * 6}px ${f.size * 1.5}px ${f.hue}33`,
          }}
          animate={{
            y: [0, -f.drift, 0],
            x: [0, f.drift * 0.4, 0],
            opacity: [0.15, 0.9, 0.15],
          }}
          transition={{
            duration: f.duration,
            delay: f.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
import React from "react";
import { motion } from "framer-motion";

// Each buddy is a little creature. One shared bobbing wrapper + a distinct
// illustrated body per variant, so the garden feels alive but cohesive.
const VARIANTS = {
  sam: { ring: "#8db580", glow: "#bfe0a8" },      // Shopping — sage raccoon
  sid: { ring: "#f4a261", glow: "#ffd29c" },      // Storefront — amber owl
  bells: { ring: "#e76f51", glow: "#ffb4a0" },    // Birthday — coral bird
  med: { ring: "#7fb6c9", glow: "#bfe4ee" },       // Meds — mint capsule
};

function Eyes({ cx = 60, cy = 56, spread = 11 }) {
  return (
    <g>
      <circle cx={cx - spread} cy={cy} r="5" fill="#2a1b3d" />
      <circle cx={cx + spread} cy={cy} r="5" fill="#2a1b3d" />
      <circle cx={cx - spread + 1.6} cy={cy - 1.6} r="1.7" fill="#fff" />
      <circle cx={cx + spread + 1.6} cy={cy - 1.6} r="1.7" fill="#fff" />
    </g>
  );
}

function Body({ variant }) {
  switch (variant) {
    case "sam":
      return (
        <g>
          {/* basket body */}
          <ellipse cx="60" cy="66" rx="34" ry="30" fill="#a8c89a" />
          <ellipse cx="60" cy="66" rx="34" ry="30" fill="none" stroke="#6f9c63" strokeWidth="2" />
          {/* raccoon mask */}
          <path d="M30 54 q30 -16 60 0 q-30 6 -60 0 z" fill="#2a1b3d" opacity="0.85" />
          <Eyes cy={56} />
          {/* little basket handle */}
          <path d="M40 40 q20 -22 40 0" fill="none" stroke="#6f9c63" strokeWidth="3" strokeLinecap="round" />
          {/* cheeks */}
          <circle cx="40" cy="70" r="5" fill="#f4a8b4" opacity="0.6" />
          <circle cx="80" cy="70" r="5" fill="#f4a8b4" opacity="0.6" />
        </g>
      );
    case "sid":
      return (
        <g>
          {/* owl body */}
          <path d="M60 30 q30 2 30 34 q0 22 -30 26 q-30 -4 -30 -26 q0 -32 30 -34 z" fill="#f4a261" />
          <path d="M60 30 q30 2 30 34 q0 22 -30 26 q-30 -4 -30 -26 q0 -32 30 -34 z" fill="none" stroke="#c9742f" strokeWidth="2" />
          {/* belly */}
          <ellipse cx="60" cy="72" rx="16" ry="14" fill="#ffe2c4" />
          {/* ear tufts */}
          <path d="M40 34 l-4 -10 l10 6 z" fill="#f4a261" />
          <path d="M80 34 l4 -10 l-10 6 z" fill="#f4a261" />
          {/* eye discs */}
          <circle cx="49" cy="56" r="9" fill="#fff" />
          <circle cx="71" cy="56" r="9" fill="#fff" />
          <circle cx="49" cy="56" r="4.5" fill="#2a1b3d" />
          <circle cx="71" cy="56" r="4.5" fill="#2a1b3d" />
          <circle cx="50.4" cy="54.6" r="1.4" fill="#fff" />
          <circle cx="72.4" cy="54.6" r="1.4" fill="#fff" />
          {/* beak */}
          <path d="M60 64 l-5 6 l10 0 z" fill="#e76f51" />
        </g>
      );
    case "bells":
      return (
        <g>
          {/* bird body */}
          <ellipse cx="60" cy="68" rx="30" ry="28" fill="#e76f51" />
          <ellipse cx="60" cy="68" rx="30" ry="28" fill="none" stroke="#b5482f" strokeWidth="2" />
          {/* belly */}
          <ellipse cx="60" cy="76" rx="16" ry="12" fill="#ffd6c4" />
          <Eyes cy={58} spread={10} />
          {/* beak */}
          <path d="M60 66 l-6 5 l12 0 z" fill="#f4a261" />
          {/* party hat */}
          <path d="M60 18 l-14 22 l28 0 z" fill="#7fb6c9" />
          <path d="M60 18 l-14 22 l28 0 z" fill="none" stroke="#fff" strokeWidth="1.5" />
          <circle cx="60" cy="16" r="4" fill="#ffd9a0" />
          {/* little feet */}
          <path d="M50 94 l-4 4 M54 94 l0 5" stroke="#b5482f" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M70 94 l4 4 M66 94 l0 5" stroke="#b5482f" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
    case "med":
      return (
        <g>
          {/* capsule body */}
          <rect x="28" y="40" width="64" height="44" rx="22" fill="#7fb6c9" />
          <rect x="28" y="40" width="32" height="44" rx="22" fill="#bfe4ee" />
          <rect x="28" y="40" width="64" height="44" rx="22" fill="none" stroke="#4d8fa6" strokeWidth="2" />
          <line x1="60" y1="40" x2="60" y2="84" stroke="#4d8fa6" strokeWidth="2" />
          <Eyes cy={60} spread={11} />
          {/* cheeks */}
          <circle cx="40" cy="70" r="4" fill="#f4a8b4" opacity="0.6" />
          <circle cx="80" cy="70" r="4" fill="#f4a8b4" opacity="0.6" />
          {/* little arms holding a cross */}
          <path d="M86 64 l8 -2 M90 60 l0 8 M86 64 l6 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
    default:
      return null;
  }
}

export default function BuddyCreature({ variant = "sam", size = 96, active = true }) {
  const c = VARIANTS[variant] ?? VARIANTS.sam;
  return (
    <div
      className="relative flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 50% 45%, ${c.glow}55, transparent 70%)`,
      }}
    >
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        animate={active ? { y: [0, -5, 0], rotate: [0, 1.5, 0] } : {}}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <Body variant={variant} />
      </motion.svg>
    </div>
  );
}
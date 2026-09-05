import React from "react";

// The workshop bot — a simple friendly robot. It sits dark and sleepy until
// its job is built; then its eyes glow mint and its bulb lights gold.
export default function WorkshopBot({ powered, size = 128 }) {
  const eye = powered ? "#6DE5C0" : "#40406B";
  const skin = "#1B1B2E";
  const edge = powered ? "rgba(109,229,192,.55)" : "#40406B";
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <line x1="60" y1="7" x2="60" y2="17" stroke="#404060" strokeWidth="3" />
      <circle
        cx="60"
        cy="7"
        r="5"
        fill={powered ? "#FFC675" : "#40406B"}
        style={powered ? { filter: "drop-shadow(0 0 7px #FFC675)" } : undefined}
      />
      <rect x="28" y="18" width="64" height="52" rx="16" fill={skin} stroke={edge} strokeWidth="2" />
      <circle
        cx="46"
        cy="40"
        r="7"
        fill={eye}
        style={powered ? { filter: "drop-shadow(0 0 7px #6DE5C0)" } : undefined}
      />
      <circle
        cx="74"
        cy="40"
        r="7"
        fill={eye}
        style={powered ? { filter: "drop-shadow(0 0 7px #6DE5C0)" } : undefined}
      />
      <path
        d="M50 55 Q60 61 70 55"
        stroke={powered ? "#6DE5C0" : "#40406B"}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <rect x="14" y="30" width="10" height="26" rx="5" fill={skin} stroke="#40406B" strokeWidth="2" />
      <rect x="96" y="30" width="10" height="26" rx="5" fill={skin} stroke="#40406B" strokeWidth="2" />
      <rect x="38" y="74" width="44" height="9" rx="4.5" fill={skin} stroke="#40406B" strokeWidth="2" />
      <rect x="32" y="85" width="56" height="14" rx="7" fill={skin} stroke={edge} strokeWidth="2" />
      <circle cx="52" cy="92" r="2.5" fill={powered ? "#6DE5C0" : "#40406B"} />
      <circle cx="68" cy="92" r="2.5" fill={powered ? "#FFC675" : "#40406B"} />
    </svg>
  );
}
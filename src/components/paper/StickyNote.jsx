import React from "react";

// A small glass card for the original note. Tilt is optional — the new
// theme keeps it flat and clean unless a fixed rotation is asked for.
export default function StickyNote({ id, caption, children, paper, className = "", fixedRotation }) {
  const tilt = fixedRotation !== undefined ? fixedRotation : 0;
  return (
    <div
      className={`glass rounded-2xl ${className}`}
      style={{
        background: paper || undefined,
        transform: tilt ? `rotate(${tilt}deg)` : undefined,
      }}
    >
      {caption && (
        <div className="font-mono text-[9.5px] tracking-[0.14em] text-neutral-400">{caption}</div>
      )}
      <div className="font-heading text-[16px] font-medium leading-snug text-neutral-900">{children}</div>
    </div>
  );
}
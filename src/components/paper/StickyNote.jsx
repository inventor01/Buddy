import React from "react";

// Square sticky-note paper. Rotation is decorative and derived
// deterministically from the id so it never changes between renders.
const rotation = (id) => {
  const h = (id || "x").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return ((h % 7) - 3) * 0.55;
};

export default function StickyNote({ id, caption, children, paper, className = "", fixedRotation }) {
  return (
    <div
      className={className}
      style={{
        background: paper || "var(--paper-note)",
        boxShadow: "0 16px 26px -20px rgba(60,45,25,.8)",
        transform: `rotate(${fixedRotation !== undefined ? fixedRotation : rotation(id)}deg)`,
      }}
    >
      {caption && (
        <div className="font-mono text-[9.5px] tracking-[0.14em]" style={{ color: "rgba(60,45,25,.55)" }}>
          {caption}
        </div>
      )}
      <div className="font-hand text-[19px] leading-tight text-ink-warm">{children}</div>
    </div>
  );
}
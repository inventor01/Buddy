import React from "react";

// Category colors — when: mint, what: gold, tells: violet.
export const CAT_COLORS = { when: "#6DE5C0", what: "#FFC675", tells: "#8B7FD6" };
export const CAT_LABELS = { when: "WHEN", what: "WHAT", tells: "TELLS" };

// One glowing workshop block. Purely presentational — the tray or the socket
// wraps it in the drag machinery, and a tap does the same job as a drag.
export default function TaskBlock({ block, placed, isDragging, onTap }) {
  const color = CAT_COLORS[block.cat];
  return (
    <div
      onClick={onTap}
      className={`flex w-full cursor-grab items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left transition-all active:cursor-grabbing ${
        isDragging ? "opacity-80" : ""
      }`}
      style={{
        borderColor: placed ? color + "99" : color + "4d",
        background: placed ? color + "26" : color + "14",
        boxShadow: placed ? `0 0 22px -8px ${color}` : undefined,
      }}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
      <span className="text-[14px] font-medium" style={{ color: "#F0F0F0" }}>
        {block.label}
      </span>
      <span className="ml-auto shrink-0 text-[10px] font-semibold tracking-[0.14em]" style={{ color: color + "b3" }}>
        {CAT_LABELS[block.cat]}
      </span>
    </div>
  );
}
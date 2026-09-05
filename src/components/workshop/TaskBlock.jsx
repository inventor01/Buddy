import React from "react";

// Category colors — when: mint, what: gold, tells: violet.
export const CAT_COLORS = { when: "#6DE5C0", what: "#FFC675", tells: "#8B7FD6" };
export const CAT_LABELS = { when: "WHEN", what: "WHAT", tells: "TELLS" };

// One workshop block — identical in the tray and on the bot: same height,
// same shape, same layout, so a dropped block sits flush in its socket.
export default function TaskBlock({ block, isDragging, onTap }) {
  const color = CAT_COLORS[block.cat];
  return (
    <div
      onClick={onTap}
      className={`flex h-12 w-full cursor-grab items-center gap-2.5 rounded-xl border px-3.5 transition-all active:cursor-grabbing ${
        isDragging ? "opacity-90" : ""
      }`}
      style={{
        borderColor: isDragging ? color : color + "4d",
        background: color + "14",
        boxShadow: isDragging ? `0 0 24px -6px ${color}` : undefined,
      }}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
      <span className="truncate text-[13.5px] font-medium" style={{ color: "#F0F0F0" }}>
        {block.label}
      </span>
      <span
        className="ml-auto shrink-0 text-[10px] font-semibold tracking-[0.14em]"
        style={{ color: color + "b3" }}
      >
        {CAT_LABELS[block.cat]}
      </span>
    </div>
  );
}
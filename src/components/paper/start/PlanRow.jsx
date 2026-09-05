import React from "react";

// One of the three plain sentences (when / what / tells) — a soft rounded
// tile you can retap to change, never a settings screen.
export default function PlanRow({ label, value, editing, onToggleEdit, onChange, onCommit }) {
  return (
    <div className="rounded-2xl border border-hairline bg-[#FAF6ED] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span
          className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: "rgba(60,45,25,.5)" }}
        >
          {label}
        </span>
        <button
          type="button"
          onClick={onToggleEdit}
          className="text-[12.5px] font-semibold"
          style={{ color: "var(--terracotta)" }}
        >
          change
        </button>
      </div>
      {editing ? (
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
          onKeyDown={(e) => e.key === "Enter" && onCommit()}
          className="mt-2 w-full rounded-xl border border-hairline bg-white px-3 py-1.5 text-[16px] text-ink-warm outline-none"
        />
      ) : (
        <p className="mt-1.5 text-[16px] leading-snug text-ink-warm">{value}</p>
      )}
    </div>
  );
}
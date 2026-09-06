import React from "react";
import { Link } from "react-router-dom";
import moment from "moment";
import { PencilIcon, BookIcon } from "./Icons";

// The left rail — a conversation list. Every note is its own chat,
// and each row previews the note it was pinned from. The Notes/Book
// switch decides what fills the main column beside it; the list of
// notes stays here either way.

function SegmentButton({ selected, onClick, icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-[7px] text-[12px] font-semibold transition-colors"
      style={{
        background: selected ? "#18181B" : "transparent",
        color: selected ? "#fff" : "rgba(113,113,122,.9)",
      }}
    >
      {icon}
      {children}
    </button>
  );
}

export default function Rail({
  buddies,
  selectedId,
  onSelect,
  onNewNote,
  view,
  onViewChange,
  onSignOut,
  onToggleBigText,
  bigText,
}) {
  return (
    <div className="flex h-full flex-col gap-3.5 overflow-hidden p-[18px]">
      <button
        type="button"
        onClick={onNewNote}
        className="w-full rounded-xl border border-dashed border-neutral-300 px-3 py-2.5 text-left text-[13.5px] font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-white/50"
      >
        + New note
      </button>

      <div
        className="flex gap-[3px] rounded-full border border-white/60 p-[3px]"
        style={{ background: "rgba(255,255,255,.45)" }}
      >
        <SegmentButton selected={view === "notes"} onClick={() => onViewChange("notes")} icon={<PencilIcon />}>
          Notes
        </SegmentButton>
        <SegmentButton selected={view === "book"} onClick={() => onViewChange("book")} icon={<BookIcon />}>
          Book
        </SegmentButton>
      </div>

      <div className="grid content-start gap-[3px]">
          {(buddies || []).map((b) => {
            const sel = b.id === selectedId;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onSelect(b.id)}
                className={`w-full rounded-xl px-2.5 py-2 text-left transition-colors ${
                  sel
                    ? "border border-white/70 shadow-[0_4px_16px_-8px_rgba(24,28,45,.18)]"
                    : "hover:bg-white/45"
                }`}
                style={{ background: sel ? "rgba(255,255,255,.7)" : "transparent" }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13.5px] font-medium leading-tight text-neutral-900">
                    {b.name}
                  </span>
                  <span className="shrink-0 font-mono text-[9.5px] text-neutral-400">
                    {moment(b.updated_date).fromNow(true)}
                  </span>
                </div>
                <div className="truncate text-[11.5px] leading-tight text-neutral-500">{b.note}</div>
              </button>
            );
          })}
        {(!buddies || buddies.length === 0) && (
          <p className="px-2.5 py-2 text-[12px] text-neutral-400">
            Nothing pinned yet. Write your first note.
          </p>
        )}
      </div>

      <div className="mt-auto border-t border-white/60 pt-3">
        <p className="text-[11px] text-neutral-500">Three notes free · $6 a month for unlimited</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500">
          <Link to="/settings" className="transition-colors hover:text-neutral-900">
            Settings
          </Link>
          <button type="button" onClick={onToggleBigText} className="transition-colors hover:text-neutral-900">
            {bigText ? "Smaller text" : "Bigger text"}
          </button>
          <button type="button" onClick={onSignOut} className="transition-colors hover:text-neutral-900">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
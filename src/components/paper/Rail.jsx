import React from "react";
import { Link } from "react-router-dom";
import moment from "moment";
import { PencilIcon, BookIcon } from "./Icons";
import BookPage from "./BookPage";

// The left rail — a conversation list. Every note is its own chat,
// and each row previews the note it was pinned from.

function SegmentButton({ selected, onClick, icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-[7px] text-[12px] font-semibold transition-colors"
      style={{
        background: selected ? "var(--ink-warm)" : "transparent",
        color: selected ? "#fff" : "rgba(60,45,25,.7)",
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
        className="w-full border border-dashed px-3 py-2.5 text-left font-hand text-[17px] leading-none text-ink-warm transition-colors hover:bg-white/60"
        style={{ borderColor: "rgba(60,45,25,.35)" }}
      >
        + New note
      </button>

      <div className="flex gap-[3px] rounded-full p-[3px]" style={{ background: "rgba(60,45,25,.09)" }}>
        <SegmentButton selected={view === "notes"} onClick={() => onViewChange("notes")} icon={<PencilIcon />}>
          Notes
        </SegmentButton>
        <SegmentButton selected={view === "book"} onClick={() => onViewChange("book")} icon={<BookIcon />}>
          Book
        </SegmentButton>
      </div>

      {view === "notes" ? (
        <div className="grid content-start gap-[2px]">
          {(buddies || []).map((b) => {
            const sel = b.id === selectedId;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onSelect(b.id)}
                className="w-full px-2.5 py-2 text-left"
                style={{
                  background: sel ? "#fff" : "transparent",
                  borderLeft: `3px solid ${sel ? "var(--terracotta)" : "rgba(60,45,25,.18)"}`,
                }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-hand text-[15px] leading-tight text-ink-warm">{b.name}</span>
                  <span className="shrink-0 font-mono text-[9.5px]" style={{ color: "rgba(60,45,25,.5)" }}>
                    {moment(b.updated_date).fromNow(true)}
                  </span>
                </div>
                <div className="truncate text-[11.5px] leading-tight" style={{ color: "rgba(60,45,25,.6)" }}>
                  {b.note}
                </div>
              </button>
            );
          })}
          {(!buddies || buddies.length === 0) && (
            <p className="px-2.5 py-2 text-[12px]" style={{ color: "rgba(60,45,25,.5)" }}>
              Nothing pinned yet. Write your first note.
            </p>
          )}
        </div>
      ) : (
        <BookPage buddies={buddies} />
      )}

      <div className="mt-auto border-t border-hairline pt-3">
        <p className="text-[11px]" style={{ color: "rgba(60,45,25,.55)" }}>
          Three notes free · $6 a month for unlimited
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: "rgba(60,45,25,.55)" }}>
          <Link to="/settings" className="transition-colors hover:text-ink-warm">
            Settings
          </Link>
          <button type="button" onClick={onToggleBigText} className="transition-colors hover:text-ink-warm">
            {bigText ? "Smaller text" : "Bigger text"}
          </button>
          <button type="button" onClick={onSignOut} className="transition-colors hover:text-ink-warm">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
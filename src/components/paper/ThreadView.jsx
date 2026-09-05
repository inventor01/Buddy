import React, { useState } from "react";
import moment from "moment";
import { ArrowRight, Loader2 } from "lucide-react";
import StickyNote from "./StickyNote";

// The note's thread — what you wrote, pinned at the top, then everything
// it did and said, oldest to newest. You can pause it, rewrite the note,
// or ask it something.
const fmtAt = (at) => moment(at).format("MMM D, h:mm A");

export default function ThreadView({ buddy, onPause, onTakeDown, onEditNote, onSend, busy }) {
  const active = buddy.status !== "paused";
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(buddy.note);

  const messages =
    Array.isArray(buddy.messages) && buddy.messages.length
      ? buddy.messages
      : Array.isArray(buddy.last_result) && buddy.last_result.length
      ? [{ who: "note", at: buddy.last_run_date || buddy.updated_date, text: buddy.last_result.join("\n") }]
      : [];

  const send = () => {
    if (!draft.trim() || busy) return;
    onSend(buddy, draft.trim());
    setDraft("");
  };

  return (
    <div className="mx-auto max-w-[720px]">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-hand text-[23px] leading-tight text-ink-warm">{buddy.name}</h2>
          <p className="mt-0.5 text-[11.5px]" style={{ color: "rgba(60,45,25,.6)" }}>
            {[buddy.when_line, buddy.what_line].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onPause(buddy)}
            className="border border-hairline bg-white px-3 py-1.5 text-[12px] font-medium text-ink-warm transition-colors hover:bg-black/[0.03]"
          >
            {active ? "Pause" : "Resume"}
          </button>
          <button
            type="button"
            onClick={() => onTakeDown(buddy)}
            className="border border-hairline bg-white px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-black/[0.03]"
            style={{ color: "rgba(60,45,25,.6)" }}
          >
            Take down
          </button>
        </div>
      </div>

      {/* the original note, pinned */}
      {editing ? (
        <div className="mx-auto mt-7 w-[300px] p-4" style={{ background: "var(--paper-note)", boxShadow: "0 16px 26px -20px rgba(60,45,25,.8)", transform: "rotate(-1.2deg)" }}>
          <textarea
            value={edited}
            onChange={(e) => setEdited(e.target.value)}
            rows={3}
            className="w-full resize-none bg-transparent font-hand text-[19px] leading-tight text-ink-warm outline-none"
          />
          <div className="mt-2 flex gap-3 text-[12px]">
            <button
              type="button"
              onClick={() => {
                onEditNote(buddy, edited.trim() || buddy.note);
                setEditing(false);
              }}
              className="font-semibold"
              style={{ color: "var(--terracotta)" }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setEdited(buddy.note);
              }}
              style={{ color: "rgba(60,45,25,.6)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex justify-center">
          <StickyNote id={buddy.id} caption="THE NOTE YOU WROTE" fixedRotation={-1.2} className="w-[300px] p-4 text-center">
            {buddy.note}
          </StickyNote>
        </div>
      )}
      {!editing && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[12px] font-medium"
            style={{ color: "var(--terracotta)" }}
          >
            Edit the note
          </button>
        </div>
      )}

      {/* the conversation */}
      <div className="mt-6">
        {messages.length === 0 && (
          <p className="py-6 text-center text-[13px]" style={{ color: "rgba(60,45,25,.55)" }}>
            Nothing yet — it runs on its schedule, or ask it something below.
          </p>
        )}
        {messages.map((m, i) => {
          const it = m.who !== "you";
          return (
            <div key={i} className={`mt-3 flex flex-col ${it ? "items-start" : "items-end"}`}>
              <span
                className="font-mono text-[9.5px] tracking-[0.14em]"
                style={{ color: it ? "rgba(60,45,25,.5)" : "rgba(255,255,255,.6)" }}
              >
                {it ? "THE NOTE" : "YOU"} · {fmtAt(m.at)}
              </span>
              <div
                className="mt-1 max-w-[74%] whitespace-pre-line px-4 py-2.5 text-[14px] leading-snug"
                style={{
                  background: it ? "#fff" : "var(--ink-warm)",
                  color: it ? "var(--ink-warm)" : "oklch(0.96 0.02 85)",
                }}
              >
                {m.text}
              </div>
            </div>
          );
        })}
        {busy && (
          <p className="mt-4 flex items-center gap-1.5 font-hand text-[16px]" style={{ color: "rgba(60,45,25,.6)" }}>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--terracotta)" }} />
            checking…
          </p>
        )}
      </div>

      {/* talk to it */}
      <div className="mt-6 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Change something about this note, or ask it a question…"
          className="flex-1 border border-hairline bg-white px-4 py-2.5 text-[14px] text-ink-warm outline-none placeholder:opacity-45"
        />
        <button
          type="button"
          onClick={send}
          disabled={busy || !draft.trim()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white disabled:opacity-40"
          style={{ background: "var(--ink-warm)" }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
      <p className="mt-2 text-[11.5px]" style={{ color: "rgba(60,45,25,.5)" }}>
        Every reply names where it read the answer. When it finds nothing, it says so.
      </p>
    </div>
  );
}
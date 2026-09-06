import React, { useState } from "react";
import moment from "moment";
import { ArrowRight, Loader2 } from "lucide-react";
import StickyNote from "./StickyNote";
import LinkedText from "@/components/maker/LinkedText";
import ProductCard from "@/components/maker/ProductCard";
import FindingRow from "@/components/maker/FindingRow";

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
    const msg = draft.trim();
    if (!msg || busy) return;
    onSend(buddy, msg);
    setDraft("");
  };

  return (
    <div className="mx-auto max-w-[720px]">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-[22px] font-semibold leading-tight tracking-tight text-neutral-900">
            {buddy.name}
          </h2>
          <p className="mt-0.5 text-[11.5px] text-neutral-500">
            {[buddy.when_line, buddy.what_line].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onPause(buddy)}
            className="rounded-full border border-white/70 bg-white/60 px-3.5 py-1.5 text-[12px] font-medium text-neutral-700 backdrop-blur-xl transition-colors hover:bg-white/85"
          >
            {active ? "Pause" : "Resume"}
          </button>
          <button
            type="button"
            onClick={() => onTakeDown(buddy)}
            className="rounded-full border border-white/70 bg-white/60 px-3.5 py-1.5 text-[12px] font-medium text-neutral-500 backdrop-blur-xl transition-colors hover:bg-white/85 hover:text-neutral-800"
          >
            Take down
          </button>
        </div>
      </div>

      {/* the original note, pinned */}
      {editing ? (
        <div className="glass mx-auto mt-7 w-[320px] rounded-2xl p-4">
          <textarea
            value={edited}
            onChange={(e) => setEdited(e.target.value)}
            rows={3}
            className="w-full resize-none bg-transparent text-[15px] leading-snug text-neutral-900 outline-none"
          />
          <div className="mt-2 flex gap-3 text-[12px]">
            <button
              type="button"
              onClick={() => {
                onEditNote(buddy, edited.trim() || buddy.note);
                setEditing(false);
              }}
              className="font-semibold text-neutral-900"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setEdited(buddy.note);
              }}
              className="text-neutral-500"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex justify-center">
          <StickyNote id={buddy.id} caption="WHAT YOU WROTE" fixedRotation={0} className="w-[320px] p-4 text-center">
            {buddy.note}
          </StickyNote>
        </div>
      )}
      {!editing && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[12px] font-medium text-neutral-500 transition-colors hover:text-neutral-900"
          >
            Edit the note
          </button>
        </div>
      )}

      {/* the conversation */}
      <div className="mt-6">
        {messages.length === 0 && (
          <p className="py-6 text-center text-[13px] text-neutral-400">
            Nothing yet — it runs on its schedule, or ask it something below.
          </p>
        )}
        {messages.map((m, i) => {
          const it = m.who !== "you";
          return (
            <div key={i} className={`mt-3 flex flex-col ${it ? "items-start" : "items-end"}`}>
              <span className="font-mono text-[9.5px] tracking-[0.14em] text-neutral-400">
                {it ? "THE NOTE" : "YOU"} · {fmtAt(m.at)}
              </span>
              {it && Array.isArray(m.items) && m.items.length ? (
                <div className="glass mt-1 max-w-[86%] space-y-2 rounded-2xl rounded-tl-md p-2.5">
                  {m.items.map((f, j) =>
                    f.product ? (
                      <ProductCard key={j} item={f} />
                    ) : (
                      <div key={j} className="px-1 py-1">
                        <FindingRow item={f} />
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div
                  className={`mt-1 max-w-[74%] whitespace-pre-line px-4 py-2.5 text-[14px] leading-snug ${
                    it
                      ? "glass rounded-2xl rounded-tl-md text-neutral-900"
                      : "rounded-2xl rounded-tr-md bg-neutral-900 text-white"
                  }`}
                >
                  <LinkedText>{m.text}</LinkedText>
                </div>
              )}
            </div>
          );
        })}
        {busy && (
          <p className="mt-4 flex items-center gap-1.5 text-[14px] text-neutral-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            checking…
          </p>
        )}
      </div>

      {/* talk to it */}
      <div className="glass mt-6 flex items-center gap-2 rounded-full py-1.5 pl-4 pr-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Change something about this note, or ask it a question…"
          className="flex-1 bg-transparent text-[14px] text-neutral-900 outline-none placeholder:text-neutral-400"
        />
        <button
          type="button"
          onClick={send}
          disabled={busy || !draft.trim()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-900 text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
      <p className="mt-2 text-[11.5px] text-neutral-400">
        Every reply names where it read the answer. When it finds nothing, it says so.
      </p>
    </div>
  );
}
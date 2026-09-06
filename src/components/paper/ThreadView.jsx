import React, { useState } from "react";
import moment from "moment";
import { ArrowRight, Loader2 } from "lucide-react";
import StickyNote from "./StickyNote";
import LinkedText from "@/components/maker/LinkedText";
import ProductCard from "@/components/maker/ProductCard";
import FindingRow from "@/components/maker/FindingRow";
import { relevantProfileFacts } from "@/lib/personalization";

// The note's thread — what you wrote, pinned at the top, then everything
// it did and said, oldest to newest. You can pause it, rewrite the note,
// or ask it something.
const fmtAt = (at) => moment(at).format("MMM D, h:mm A");

export default function ThreadView({ buddy, profile, onPause, onTakeDown, onEditNote, onSend, onApprove, onReject, busy }) {
  const done = buddy.status === "done";
  const active = buddy.status === "active";
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(buddy.note);
  const personalFacts = relevantProfileFacts(profile, `${buddy.note || ""} ${buddy.what_line || ""}`);

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
            {buddy.run_mode === "once" ? "Handled once" : buddy.run_mode === "repeat" ? "Keeps doing this" : "Keeping watch"}
            {buddy.when_line ? ` · ${buddy.when_line}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {done ? (
            <span className="rounded-full border border-emerald-100 bg-emerald-50/80 px-3.5 py-1.5 text-[12px] font-medium text-emerald-700">
              Done
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onPause(buddy)}
              className="rounded-full border border-white/70 bg-white/60 px-3.5 py-1.5 text-[12px] font-medium text-neutral-700 backdrop-blur-xl transition-colors hover:bg-white/85"
            >
              {active ? "Pause" : "Resume"}
            </button>
          )}
          <button
            type="button"
            onClick={() => onTakeDown(buddy)}
            className="rounded-full border border-white/70 bg-white/60 px-3.5 py-1.5 text-[12px] font-medium text-neutral-500 backdrop-blur-xl transition-colors hover:bg-white/85 hover:text-neutral-800"
          >
            Take down
          </button>
        </div>
      </div>

      {personalFacts.length > 0 && (
        <div className="mt-5 rounded-2xl border border-emerald-100/80 bg-emerald-50/55 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Using what you told Buddy</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {personalFacts.map((fact) => (
              <span key={fact} className="rounded-full border border-emerald-100 bg-white/70 px-2.5 py-1 text-[11.5px] text-neutral-600">{fact}</span>
            ))}
          </div>
          <a href="/settings" className="mt-2 inline-block text-[11px] font-medium text-emerald-700 hover:text-emerald-900">Change what Buddy knows</a>
        </div>
      )}

      {(buddy.approval_status === "pending" || buddy.approval_status === "needs_connection") && (
        <div className="glass mt-6 rounded-2xl p-5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-amber-700">
            {buddy.approval_status === "needs_connection" ? "One connection needed" : "Ready for your approval"}
          </p>
          <h3 className="mt-2 font-heading text-[19px] font-semibold text-neutral-900">
            {buddy.action_type === "email_send" ? "Send this email" : buddy.action_type === "calendar_create" ? "Add this to your calendar" : buddy.action_type === "task_create" ? "Add this to your tasks" : "Carry this out"}
          </h3>
          <div className="mt-3 space-y-1.5 text-[13.5px] leading-relaxed text-neutral-600">
            {buddy.action_payload?.recipient && <p><span className="font-medium text-neutral-900">To:</span> {buddy.action_payload.recipient}</p>}
            {buddy.action_payload?.subject && <p><span className="font-medium text-neutral-900">Subject:</span> {buddy.action_payload.subject}</p>}
            {buddy.action_payload?.title && <p><span className="font-medium text-neutral-900">What:</span> {buddy.action_payload.title}</p>}
            {buddy.action_payload?.start && <p><span className="font-medium text-neutral-900">When:</span> {buddy.action_payload.start}</p>}
            {buddy.action_payload?.body && <p className="mt-2 whitespace-pre-line rounded-xl bg-white/60 p-3 text-neutral-700">{buddy.action_payload.body}</p>}
            {buddy.action_payload?.notes && <p className="mt-2 whitespace-pre-line rounded-xl bg-white/60 p-3 text-neutral-700">{buddy.action_payload.notes}</p>}
          </div>
          {buddy.approval_status === "needs_connection" ? (
            <a href="/settings" className="mt-4 inline-flex rounded-full bg-neutral-900 px-4 py-2 text-[13px] font-medium text-white">
              Connect it in Settings
            </a>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => onApprove?.(buddy)} disabled={busy} className="rounded-full bg-neutral-900 px-4 py-2 text-[13px] font-medium text-white disabled:opacity-40">
                Approve and do it
              </button>
              <button type="button" onClick={() => onReject?.(buddy)} disabled={busy} className="rounded-full border border-neutral-200 bg-white/70 px-4 py-2 text-[13px] font-medium text-neutral-600 disabled:opacity-40">
                Don’t do this
              </button>
            </div>
          )}
          <p className="mt-3 text-[11.5px] text-neutral-400">Buddy will never send or change this without your approval.</p>
        </div>
      )}

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
            Nothing yet — Buddy will handle it the way you asked, or you can add a follow-up below.
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
          placeholder="Change the request or ask a follow-up…"
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
        When Buddy uses the web, it shows where the answer came from. If nothing meaningful changed, it stays quiet.
      </p>
    </div>
  );
}
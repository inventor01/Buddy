import React, { useState } from "react";
import moment from "moment";
import { ArrowRight, Loader2 } from "lucide-react";
import StickyNote from "./StickyNote";
import LinkedText from "@/components/maker/LinkedText";
import ProductCard from "@/components/maker/ProductCard";
import FindingRow from "@/components/maker/FindingRow";
import DealCard from "@/components/maker/DealCard";
import { relevantProfileFacts } from "@/lib/personalization";

// The note's thread — what you wrote, pinned at the top, then everything
// it did and said, oldest to newest. You can pause it, rewrite the note,
// or ask it something.
const BUDDY_REQUEST_MAX = 8000;
const fmtAt = (at) => moment(at).format("MMM D, h:mm A");
const STEP_LABELS = {
  domain_property: "Checked live property data",
  web_research: "Researched current sources",
  browser_fetch: "Checked the live page",
  reasoning: "Analyzed the details",
  calculation: "Ran the numbers",
  connected_action: "Prepared the next step",
  verify: "Verified the result",
};

export default function ThreadView({ buddy, buddies = [], profile, receipt, job, onPause, onTakeDown, onEditNote, onSend, onApprove, onReject, onContinueChain, onOpenBuddy, busy }) {
  const done = buddy.status === "done";
  const active = buddy.status === "active";
  const waitingForResponse = buddy.chain_state?.phase === "waiting_response" && buddy.action_type === "email_read";
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(buddy.note);
  const personalFacts = relevantProfileFacts(profile, `${buddy.note || ""} ${buddy.what_line || ""}`);
  const linkedBuddies = (Array.isArray(buddy.linked_buddy_ids) ? buddy.linked_buddy_ids : [])
    .map((id) => buddies.find((b) => b.id === id))
    .filter(Boolean);
  const mentionMatch = draft.match(/(?:^|\s)@([^\s\[]*)$/);
  const mentionQuery = mentionMatch ? String(mentionMatch[1] || "").toLowerCase() : null;
  const mentionChoices = mentionQuery === null
    ? []
    : buddies.filter((b) => b.id !== buddy.id && b?.name && String(b.name).toLowerCase().includes(mentionQuery)).slice(0, 6);
  const insertMention = (name) => setDraft((current) => current.replace(/(^|\s)@[^\s\[]*$/, (_, lead) => `${lead}@[${name}] `));

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

      {linkedBuddies.length > 0 && (
        <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50/50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700">Connected chats</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {linkedBuddies.map((linked) => (
              <button key={linked.id} type="button" onClick={() => onOpenBuddy?.(linked.id)} className="rounded-full border border-sky-100 bg-white/80 px-2.5 py-1 text-[11.5px] font-medium text-sky-800 hover:bg-white">@{linked.name}</button>
            ))}
          </div>
        </div>
      )}

      {job && Array.isArray(job.steps) && job.steps.length > 1 && (
        <div className="glass mt-6 rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-sky-700">How Buddy handled this</p>
              <h3 className="mt-1.5 font-heading text-[18px] font-semibold text-neutral-900">
                {job.status === "completed"
                  ? "Checked, combined, and verified."
                  : job.status === "failed"
                    ? "Buddy saved the work it completed."
                    : job.status === "needs_approval"
                      ? "The research is done. The next step is ready for your review."
                      : job.status === "needs_user"
                        ? "Buddy is waiting on the next response or your input."
                        : "Buddy is working through the checks."}
              </h3>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${job.status === "completed" ? "bg-emerald-50 text-emerald-700" : job.status === "failed" ? "bg-rose-50 text-rose-700" : job.status === "needs_approval" ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700"}`}>
              {job.status === "completed" ? "Verified" : job.status === "failed" ? "Needs another way" : job.status === "needs_approval" ? "Needs approval" : job.status === "needs_user" ? "Waiting" : "In progress"}
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {job.steps.map((step, index) => (
              <div key={`${step.id || step.kind}-${index}`} className="flex items-start gap-2.5 rounded-xl border border-white/70 bg-white/55 px-3 py-2.5">
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${step.status === "completed" ? "bg-emerald-50 text-emerald-700" : step.status === "failed" ? "bg-rose-50 text-rose-700" : "bg-neutral-100 text-neutral-500"}`}>
                  {step.status === "completed" ? "✓" : step.status === "failed" ? "!" : index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-neutral-800">{step.label || STEP_LABELS[step.kind] || "Handled a step"}</p>
                  {step.status === "failed" && step.error && <p className="mt-0.5 line-clamp-2 text-[11px] text-rose-600">{step.error}</p>}
                </div>
              </div>
            ))}
          </div>
          {job.verification_summary && <p className="mt-3 text-[11.5px] leading-relaxed text-neutral-500">{job.verification_summary}</p>}
        </div>
      )}

      {receipt && (
        <div className="glass mt-6 rounded-2xl p-5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Buddy Receipt</p>
          <h3 className="mt-2 font-heading text-[19px] font-semibold text-neutral-900">Handled</h3>
          {receipt.summary && <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-neutral-600">{receipt.summary}</p>}
          {Array.isArray(receipt.why_chosen) && receipt.why_chosen.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold text-neutral-700">Why Buddy chose this</p>
              <ul className="mt-1.5 space-y-1 text-[12.5px] text-neutral-600">{receipt.why_chosen.map((x) => <li key={x}>✓ {x}</li>)}</ul>
            </div>
          )}
          {Array.isArray(receipt.used_context) && receipt.used_context.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold text-neutral-700">What Buddy used</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">{receipt.used_context.map((x) => <span key={x} className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] text-neutral-500">{x}</span>)}</div>
            </div>
          )}
          {Array.isArray(receipt.changes_made) && receipt.changes_made.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold text-neutral-700">What changed</p>
              <ul className="mt-1.5 space-y-1 text-[12.5px] text-neutral-600">{receipt.changes_made.map((x) => <li key={x}>✓ {x}</li>)}</ul>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-neutral-400">
            {receipt.completed_at && <span>{fmtAt(receipt.completed_at)}</span>}
            {Number(receipt.estimated_time_saved_minutes) > 0 && <span>~{receipt.estimated_time_saved_minutes} min back</span>}
          </div>
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
            rows={5}
            maxLength={BUDDY_REQUEST_MAX}
            className="w-full resize-y bg-transparent text-[15px] leading-snug text-neutral-900 outline-none"
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

      {waitingForResponse && (
        <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/55 p-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-indigo-700">Waiting on the email thread</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-600">Buddy can check for new replies, review what came back, and prepare the next response for your approval.</p>
          <button type="button" onClick={() => onContinueChain?.(buddy)} disabled={busy} className="mt-3 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-[12.5px] font-medium text-white disabled:opacity-40">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Check responses
          </button>
          <p className="mt-2 text-[10.5px] text-neutral-400">Email reply checking currently runs when you ask Buddy to check; outgoing replies still require approval.</p>
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
                    f.deal ? (
                      <DealCard key={j} item={f} />
                    ) : f.product ? (
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
      <div className="glass mt-6 rounded-2xl p-2.5">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          maxLength={BUDDY_REQUEST_MAX}
          placeholder="Change the request or ask a follow-up…"
          className="w-full resize-y bg-transparent px-2 py-1.5 text-[14px] leading-relaxed text-neutral-900 outline-none placeholder:text-neutral-400"
        />
        {mentionChoices.length > 0 && (
          <div className="mb-2 rounded-xl border border-white/80 bg-white/90 p-1.5 shadow-sm">
            {mentionChoices.map((linked) => (
              <button key={linked.id} type="button" onClick={() => insertMention(linked.name)} className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[12.5px] text-neutral-700 hover:bg-neutral-50">
                <span className="truncate font-medium">@{linked.name}</span>
                <span className="ml-3 shrink-0 text-[10.5px] text-neutral-400">connect this chat</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="text-[10px] tabular-nums text-neutral-400">
            {draft.length.toLocaleString()}/{BUDDY_REQUEST_MAX.toLocaleString()}
          </span>
          <button
            type="button"
            onClick={send}
            disabled={busy || !draft.trim()}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-900 text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <p className="mt-2 text-[11.5px] text-neutral-400">
        Type @ to bring another Buddy chat into this one. When Buddy uses the web, it shows where the answer came from.
      </p>
    </div>
  );
}
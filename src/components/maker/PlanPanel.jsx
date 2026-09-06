import React, { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import PlanBoard from "./PlanBoard";

// The plan step for signed-in users — same as the landing page: read the
// sentence back as WHEN / WHAT / TELLS cards you can drag and reword
// before it runs for real.

const CATS = ["when", "what", "tells"];

export default function PlanPanel({ note, lines, question, linkedBuddyNames = [], taskSteps = [], answer, onAnswer, onChange, onRun, onCancel, busy }) {
  const [order, setOrder] = useState(CATS);
  const [editing, setEditing] = useState(null);

  const reorder = (s, d) =>
    setOrder((o) => {
      const next = [...o];
      const [moved] = next.splice(s, 1);
      next.splice(d, 0, moved);
      return next;
    });

  const kicker = "text-[10.5px] font-semibold uppercase tracking-[0.2em] text-neutral-400";

  return (
    <div className="mx-auto max-w-[640px]">
      <div className="glass rounded-[24px] p-6 sm:p-8">
        <p className={kicker}>What you said</p>
        <p className="mt-1.5 font-heading text-[19px] leading-snug text-neutral-900">{note}</p>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <p className={kicker}>Here's the plan</p>
          <p className="text-[11.5px] text-neutral-400">Drag to arrange · tap the pencil to reword</p>
        </div>
        <div className="mt-3">
          <PlanBoard
            order={order}
            lines={lines}
            editing={editing}
            onReorder={reorder}
            onEdit={(c) => setEditing(editing === c ? null : c)}
            onChange={onChange}
            onCommit={() => setEditing(null)}
          />
        </div>

        {linkedBuddyNames.length > 0 && (
          <div className="mt-6 rounded-2xl border border-sky-100 bg-sky-50/55 p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-sky-700">Connected context</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-neutral-600">Buddy will use the latest useful context from these chats.</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {linkedBuddyNames.map((name) => (
                <span key={name} className="rounded-full border border-sky-100 bg-white/80 px-3 py-1.5 text-[11.5px] font-medium text-sky-800">@{name}</span>
              ))}
            </div>
          </div>
        )}

        {taskSteps.length > 1 && (
          <div className="mt-6 rounded-2xl border border-violet-100 bg-violet-50/45 p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-violet-700">One handoff · {taskSteps.length} connected steps</p>
            <div className="mt-3 space-y-2">
              {taskSteps.map((step, index) => (
                <div key={step.id || index} className="flex items-start gap-3 rounded-xl border border-white/80 bg-white/70 px-3 py-2.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-violet-100 text-[11px] font-semibold text-violet-700">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-neutral-850">{step.label || step.instruction}</p>
                    {step.instruction && step.instruction !== step.label && <p className="mt-0.5 text-[11.5px] leading-relaxed text-neutral-500">{step.instruction}</p>}
                    {step.approval_required && <span className="mt-1.5 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">asks before sending/changing</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {question && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-amber-700">
              One more thing
            </p>
            <p className="mt-1.5 text-[15px] leading-snug text-neutral-800">{question}</p>
            <input
              value={answer || ""}
              onChange={(e) => onAnswer(e.target.value)}
              placeholder="Your answer — it remembers this for every run"
              className="mt-3 w-full rounded-xl border border-amber-300 bg-white px-3.5 py-2.5 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-amber-400"
            />
          </div>
        )}

        <div className="mt-7 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onRun}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-[14px] font-medium text-white transition-all hover:bg-neutral-800 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {busy ? "Checking…" : "Run it once now"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-[13.5px] font-medium text-neutral-500 transition-colors hover:text-neutral-800"
          >
            Change the words
          </button>
        </div>
      </div>
    </div>
  );
}
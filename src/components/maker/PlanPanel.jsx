import React, { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import PlanBoard from "./PlanBoard";

// The plan step for signed-in users — same as the landing page: read the
// sentence back as WHEN / WHAT / TELLS cards you can drag and reword
// before it runs for real.

const CATS = ["when", "what", "tells"];

export default function PlanPanel({ note, lines, onChange, onRun, onCancel, busy }) {
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
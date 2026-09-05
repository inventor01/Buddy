import React from "react";
import { ExternalLink, Sparkles } from "lucide-react";

// One plain finding — the sentence plus a tappable source chip.
export default function FindingRow({ item }) {
  return (
    <div className="flex items-start gap-2.5">
      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
      <div>
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[14.5px] leading-snug text-neutral-900 underline decoration-transparent underline-offset-[3px] transition-colors hover:decoration-neutral-400"
          >
            {item.text}
          </a>
        ) : (
          <p className="text-[14.5px] leading-snug text-neutral-900">{item.text}</p>
        )}
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/60 px-2 py-0.5 text-[11px] font-medium text-neutral-600 transition-colors hover:bg-white hover:text-neutral-900"
          >
            <ExternalLink className="h-3 w-3" />
            {item.source || "Source"}
          </a>
        )}
      </div>
    </div>
  );
}
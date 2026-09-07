import React from "react";
import { ExternalLink, SearchCheck } from "lucide-react";

const money = (value) => Number(value) > 0 ? `$${Number(value).toFixed(2)}` : "—";

export default function ArbitrageLeadCard({ item }) {
  const a = item?.arbitrage_lead || {};
  const knownSide = a.buy_url ? "Buy side verified" : "Resale side verified";
  const knownPrice = a.buy_url ? a.buy_price : a.resale_price;
  const knownUrl = a.buy_url || a.resale_url;
  const knownLabel = a.buy_url ? "Store evidence" : "Resale evidence";

  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50/35 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">Promising lead · still verifying</p>
          <h4 className="mt-1.5 text-[15px] font-semibold leading-snug text-neutral-950">{a.item_name || item.text}</h4>
          <p className="mt-1 text-[11.5px] text-neutral-500">
            {[a.retailer, a.marketplace].filter(Boolean).join(" → ") || "Arbitrage candidate"}
            {a.identifier ? ` · ${a.identifier}` : ""}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/70 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
          <SearchCheck className="h-3.5 w-3.5" /> {Math.round(Number(a.confidence || 0) * 100)}% lead confidence
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-white/75 px-3 py-2.5">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-neutral-400">{knownSide}</p>
          <p className="mt-1 text-[14px] font-semibold text-neutral-900">{money(knownPrice)}</p>
        </div>
        <div className="rounded-xl bg-white/75 px-3 py-2.5">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-neutral-400">Still needed</p>
          <p className="mt-1 text-[12px] font-medium leading-snug text-neutral-700">{a.missing_evidence || "One side still needs verification."}</p>
        </div>
      </div>

      {a.reason && <p className="mt-3 text-[11.5px] leading-relaxed text-neutral-600">{a.reason}</p>}
      <div className="mt-3 rounded-xl border border-amber-100 bg-white/70 px-3.5 py-3">
        <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-amber-700">Next verification</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-neutral-700">
          {a.buy_url
            ? "Use the exact model/SKU above to confirm the matching Amazon or eBay price. Buddy will retry this lead on the next run."
            : "Find the exact retailer product/variant and current buy price. Buddy will retry this lead on the next run."}
        </p>
      </div>
      <p className="mt-2 text-[10.5px] leading-relaxed text-neutral-400">Not counted toward your profit target until both sides and the spread are verified.</p>

      {knownUrl && (
        <a href={knownUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white px-3.5 py-2 text-[11.5px] font-semibold text-neutral-700">
          {knownLabel} <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

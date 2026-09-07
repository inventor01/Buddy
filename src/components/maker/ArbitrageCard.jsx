import React from "react";
import { ExternalLink, TrendingUp } from "lucide-react";

const money = (value) => Number.isFinite(Number(value)) ? `$${Number(value).toFixed(2)}` : "—";

export default function ArbitrageCard({ item }) {
  const a = item?.arbitrage || {};
  const tier = String(a.action_tier || "promising");
  const tierLabel = tier === "check_now" ? "CHECK NOW" : tier === "low_priority" ? "LOW PRIORITY" : "PROMISING";
  const score = Math.max(0, Math.min(100, Number(a.actionability_score || 0)));
  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">{tierLabel} · Verified arbitrage</p>
          <h4 className="mt-1.5 text-[15px] font-semibold leading-snug text-neutral-950">{a.item_name || item.text}</h4>
          <p className="mt-1 text-[11.5px] text-neutral-500">{a.retailer} → {a.marketplace}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-700">{score}/100 actionability</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <TrendingUp className="h-3.5 w-3.5" /> {Number(a.roi_percent || 0).toFixed(1)}% est. ROI
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Store price", money(a.buy_price)],
          ["Net buy cost", money(a.net_buy_cost)],
          ["Resale price", money(a.resale_price)],
          ["Est. profit", money(a.estimated_profit)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-neutral-50 px-3 py-2.5">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-neutral-400">{label}</p>
            <p className="mt-1 text-[14px] font-semibold text-neutral-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-1 text-[11.5px] leading-relaxed text-neutral-500">
        {(a.brand || a.category) && <p>{[a.brand, a.category].filter(Boolean).join(" · ")}</p>}
        {Number(a.units_to_target) > 0 && <p>Target math: <strong className="text-neutral-800">~{Number(a.units_to_target)} units</strong> at this one-unit spread would equal the current weekly target.</p>}
        {a.demand_note && <p>Demand evidence: <strong className="text-neutral-800">{a.demand_note}</strong></p>}
        {Number(a.discount_amount) > 0 && (
          <p>Verified discount: <strong className="text-neutral-800">-{money(a.discount_amount)}</strong>{a.discount_description ? ` · ${a.discount_description}` : ""}</p>
        )}
        <p>Estimated marketplace/other fees included: <strong className="text-neutral-800">{money(a.estimated_fees)}</strong></p>
        {a.caveat && <p className="text-neutral-400">{a.caveat}</p>}
      </div>

      <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/55 px-3.5 py-3">
        <p className="text-[9.5px] font-semibold uppercase tracking-[0.13em] text-emerald-700">What to do now</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-neutral-700">
          {tier === "check_now"
            ? "Open both pages now, verify the exact variant and live quantity, then recheck the spread before checkout. This is one of Buddy’s strongest current candidates."
            : tier === "low_priority"
              ? "Keep this below stronger candidates. Recheck only if the buy price drops further, demand improves, or you can source multiple units cheaply."
              : "Verify the exact variant and available quantity, then recheck the resale side. Move it up only if the live spread and sourcing quantity still make sense."}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a href={a.buy_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full bg-neutral-950 px-3.5 py-2 text-[11.5px] font-semibold text-white">
          Check buy side <ExternalLink className="h-3 w-3" />
        </a>
        <a href={a.resale_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-[11.5px] font-semibold text-neutral-700">
          Check resale side <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

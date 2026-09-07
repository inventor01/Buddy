import React from "react";
import { ExternalLink, TrendingUp } from "lucide-react";

const money = (value) => Number.isFinite(Number(value)) ? `$${Number(value).toFixed(2)}` : "—";

export default function ArbitrageCard({ item }) {
  const a = item?.arbitrage || {};
  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Verified arbitrage candidate</p>
          <h4 className="mt-1.5 text-[15px] font-semibold leading-snug text-neutral-950">{a.item_name || item.text}</h4>
          <p className="mt-1 text-[11.5px] text-neutral-500">{a.retailer} → {a.marketplace}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
          <TrendingUp className="h-3.5 w-3.5" /> {Number(a.roi_percent || 0).toFixed(1)}% est. ROI
        </span>
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
        {Number(a.discount_amount) > 0 && (
          <p>Verified discount: <strong className="text-neutral-800">-{money(a.discount_amount)}</strong>{a.discount_description ? ` · ${a.discount_description}` : ""}</p>
        )}
        <p>Estimated marketplace/other fees included: <strong className="text-neutral-800">{money(a.estimated_fees)}</strong></p>
        {a.caveat && <p className="text-neutral-400">{a.caveat}</p>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a href={a.buy_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full bg-neutral-950 px-3.5 py-2 text-[11.5px] font-semibold text-white">
          Store product <ExternalLink className="h-3 w-3" />
        </a>
        <a href={a.resale_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-[11.5px] font-semibold text-neutral-700">
          Resale evidence <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

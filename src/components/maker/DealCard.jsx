import React, { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Building2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";

const money = (v) => Number(v) > 0 ? `$${Math.round(Number(v)).toLocaleString()}` : "—";

export default function DealCard({ item }) {
  const d = item.deal || {};
  const [image, setImage] = useState(d.image_url || "");
  const [loadingImage, setLoadingImage] = useState(false);
  const [broken, setBroken] = useState(false);
  const sourceUrl = d.listing_url || item.url || "";
  const scoreTone = Number(d.deal_score) >= 80 ? "text-emerald-700 bg-emerald-50" : Number(d.deal_score) >= 60 ? "text-amber-700 bg-amber-50" : "text-neutral-600 bg-neutral-100";

  const resolveImage = async () => {
    if ((!sourceUrl && !image) || loadingImage) return;
    setLoadingImage(true);
    try {
      const res = await base44.functions.invoke("resolvePreviewImage", {
        page_url: sourceUrl || undefined,
        image_url: image || undefined,
      });
      const stable = res.data?.image_url;
      if (stable) {
        setImage(stable);
        setBroken(false);
      } else {
        setBroken(true);
      }
    } catch (_) {
      setBroken(true);
    } finally {
      setLoadingImage(false);
    }
  };

  useEffect(() => {
    if (!image && sourceUrl) resolveImage();
    // source URL uniquely identifies the preview target for this card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceUrl]);

  const comps = useMemo(() => Array.isArray(d.comps) ? d.comps.slice(0, 4) : [], [d.comps]);

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white">
      <div className="relative h-44 bg-neutral-100">
        {image && !broken ? (
          <Image src={image} alt={d.address || "Property"} className="h-full w-full" fittingType="fill" onError={resolveImage} />
        ) : (
          <div className="grid h-full place-items-center text-neutral-300">
            {loadingImage ? <Loader2 className="h-6 w-6 animate-spin" /> : <Building2 className="h-8 w-8" />}
          </div>
        )}
        <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold ${scoreTone}`}>Deal score {Math.round(Number(d.deal_score) || 0)}/100</span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[15px] font-semibold text-neutral-950">{d.address}</p>
            <p className="mt-1 text-[11.5px] text-neutral-400">{[d.property_type, d.listing_type, d.days_on_market ? `${d.days_on_market} DOM` : ""].filter(Boolean).join(" · ")}</p>
          </div>
          {sourceUrl && (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full bg-neutral-950 px-3 py-1.5 text-[11.5px] font-semibold text-white">
              View listing <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["List", money(d.list_price)],
            ["ARV", money(d.arv)],
            ["Flipper max", money(d.flipper_max)],
            ["Your max contract", money(d.max_contract)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-neutral-50 px-3 py-2.5">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{label}</p>
              <p className="mt-1 text-[14px] font-semibold text-neutral-900">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <p className="rounded-xl border border-neutral-100 px-3 py-2 text-[11.5px] text-neutral-600">Repairs allowance <strong className="text-neutral-900">{money(d.repairs)}</strong></p>
          <p className="rounded-xl border border-neutral-100 px-3 py-2 text-[11.5px] text-neutral-600">Assignment target <strong className="text-neutral-900">{money(d.assignment_fee)}</strong></p>
          <p className="rounded-xl border border-neutral-100 px-3 py-2 text-[11.5px] text-neutral-600">Buyer formula <strong className="text-neutral-900">{Math.round((Number(d.investor_arv_percent) || 0) * 100)}% ARV</strong></p>
        </div>

        {d.arv_low > 0 && d.arv_high > 0 && <p className="mt-3 text-[11.5px] text-neutral-500">ARV confidence range: {money(d.arv_low)}–{money(d.arv_high)}</p>}
        {d.repair_basis && <p className="mt-1 text-[11.5px] text-neutral-500">Repair basis: {d.repair_basis}</p>}

        {comps.length > 0 && (
          <div className="mt-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Best comps</p>
            <div className="mt-2 space-y-1.5">
              {comps.map((c, i) => (
                <div key={`${c.address}-${i}`} className="flex items-center justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-2 text-[11.5px]">
                  <span className="min-w-0 truncate text-neutral-600">{c.address}</span>
                  <span className="shrink-0 font-semibold text-neutral-900">{money(c.price)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {item.why_fit && <p className="mt-4 text-[12px] font-medium text-emerald-700">Why Buddy surfaced it: {item.why_fit}</p>}
        {d.caveat && <p className="mt-4 border-t border-neutral-100 pt-3 text-[10.5px] leading-relaxed text-neutral-400">{d.caveat}</p>}
      </div>
    </div>
  );
}

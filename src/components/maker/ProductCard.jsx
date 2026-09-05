import React from "react";
import { ArrowUpRight, ShoppingBag } from "lucide-react";
import { Image } from "@/components/ui/image";

// One product finding as a card — preview image, price, stock when the
// page showed it, and a straight shot to the product page.
export default function ProductCard({ item }) {
  const p = item.product || {};
  const url = p.url || item.url || "";
  const soldOut = /sold out|out of stock/i.test(p.stock || "");

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/70 bg-white/80 p-3">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/80 bg-white/70">
        {p.image_url ? (
          <Image src={p.image_url} className="h-full w-full" fittingType="fill" />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <ShoppingBag className="h-6 w-6 text-neutral-300" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-neutral-900">{p.name || item.text}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {p.price && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[12px] font-semibold text-emerald-700">
              {p.price}
            </span>
          )}
          {p.stock && (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                soldOut
                  ? "bg-red-50 text-red-600"
                  : "border border-white/80 bg-white/70 text-neutral-500"
              }`}
            >
              {p.stock}
            </span>
          )}
          {item.source && <span className="text-[11px] text-neutral-400">{item.source}</span>}
        </div>
      </div>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-neutral-900 px-3 py-1.5 text-[11.5px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          Go to product <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}
import React, { useEffect, useState } from "react";
import { ArrowUpRight, ShoppingBag } from "lucide-react";
import { Image } from "@/components/ui/image";
import { base44 } from "@/api/base44Client";

// One product finding as a card — preview image, price, stock when the
// page showed it, and a straight shot to the product's own page. The
// whole card is the link. Store images are hotlink-protected on some
// sites, so we load them without a referrer and fall back to a branded
// tile whenever one won't load.
export default function ProductCard({ item }) {
  const p = item.product || {};
  const url = p.url || item.url || "";
  const [image, setImage] = useState(p.image_url || "");
  const [broken, setBroken] = useState(false);
  const [resolving, setResolving] = useState(false);
  const soldOut = /sold out|out of stock/i.test(p.stock || "");
  const showImage = image && !broken;

  const resolveImage = async () => {
    if ((!url && !image) || resolving) return;
    setResolving(true);
    try {
      const res = await base44.functions.invoke("resolvePreviewImage", {
        page_url: url || undefined,
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
      setResolving(false);
    }
  };

  useEffect(() => {
    if (!image && url) resolveImage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return (
    <a
      href={url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 rounded-xl border border-white/70 bg-white/80 p-3 transition-shadow ${
        url ? "hover:border-neutral-300 hover:shadow-sm" : "pointer-events-none"
      }`}
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/80 bg-white/70">
        {showImage ? (
          <Image
            src={image}
            alt={p.name || item.text}
            className="h-full w-full"
            fittingType="fill"
            referrerPolicy="no-referrer"
            onError={resolveImage}
          />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <ShoppingBag className="h-6 w-6 text-neutral-300" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-neutral-900">{p.name || item.text}</p>
        {item.why_fit && (
          <p className="mt-1 text-[11.5px] font-medium leading-snug text-emerald-700">Why this fits you: {item.why_fit}</p>
        )}
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
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-neutral-900 px-3 py-1.5 text-[11.5px] font-semibold text-white">
          Go to product <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      )}
    </a>
  );
}
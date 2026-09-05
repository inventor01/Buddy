import React, { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

// The checkout — a modal over the page, never a route change. Base44
// Payments handles the card on its own secure checkout page, so this
// sheet sells the plan and starts checkout; it never touches card data.
const INCLUDED = [
  "Unlimited notes — as many things as you like",
  "Everyone you look after, included",
  "A weekly page of your book",
];

export default function PaymentSheet({ open, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!open) return null;

  const startPro = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await base44.functions.invoke("create-checkout", { productId: "pro" });
      const url = res.data?.redirectUrl;
      if (url) {
        window.location.href = url;
        return;
      }
      setError("Couldn't start checkout — try again.");
    } catch (_) {
      setError("Couldn't start checkout — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "rgba(24,24,27,.32)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass max-h-[92dvh] w-full overflow-y-auto rounded-t-[26px] sm:w-[440px] sm:rounded-[26px]"
      >
        <div className="mx-auto mt-[10px] h-[4px] w-[38px] rounded-full bg-neutral-300/60 sm:hidden" />
        <div className="p-6 sm:p-7">
          <p className="text-center font-mono text-[10px] tracking-[0.2em] text-neutral-400">
            BUDDY PRO
          </p>
          <p className="mt-3 text-center">
            <span className="font-heading text-[40px] font-semibold tracking-tight text-neutral-900">
              $6
            </span>{" "}
            <span className="text-[14px] text-neutral-500">a month</span>
          </p>
          <p className="mt-1 text-center text-[13.5px] text-neutral-500">
            Three notes are free. Pro is everything, unlimited.
          </p>

          <div className="mt-6 space-y-2.5">
            {INCLUDED.map((line) => (
              <div key={line} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-50">
                  <Check className="h-3 w-3 text-emerald-600" />
                </span>
                <span className="text-[14px] leading-snug text-neutral-800">{line}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={startPro}
            disabled={busy}
            className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 py-3 text-[14.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "Taking you to secure checkout…" : "Start Pro — $6 a month"}
          </button>
          {error && <p className="mt-2 text-center text-[12px] text-red-600">{error}</p>}
          <p className="mt-2 text-center text-[11.5px] text-neutral-400">
            Cancel in one tap. Notes run to month's end.
          </p>

          <div className="my-5 border-t border-white/70" />

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full border border-neutral-200 bg-white/60 py-2.5 text-[13.5px] font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900"
          >
            Continue browsing
          </button>
          <p className="mt-1.5 text-center text-[11.5px] text-neutral-400">
            Your three free notes keep running either way.
          </p>
        </div>
      </div>
    </div>
  );
}
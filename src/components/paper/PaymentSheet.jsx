import React, { useState } from "react";
import { base44 } from "@/api/base44Client";

// The payment sheet — a modal over the page, never a route change.
// Base44 Payments handles the card on its own secure checkout page, so
// this sheet sells the plan and starts checkout; it never touches card data.
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
        className="glass max-h-[92dvh] w-full overflow-y-auto rounded-t-[22px] sm:w-[420px] sm:rounded-[22px]"
      >
        <div className="mx-auto mt-[10px] h-[4px] w-[38px] rounded-full bg-neutral-300/60 sm:hidden" />
        <div className="p-5">
          <p className="font-mono text-[9.5px] tracking-[0.18em] text-neutral-400">BUDDY PRO</p>
          <p className="mt-2">
            <span className="font-heading text-[25px] font-semibold text-neutral-900">$6</span>{" "}
            <span className="text-[13.5px] text-neutral-500">a month</span>
          </p>
          <p className="mt-2 text-[14px] leading-snug text-neutral-800">
            Unlimited notes, everyone you look after, weekly page of your book.
          </p>

          <button
            type="button"
            onClick={startPro}
            disabled={busy}
            className="mt-5 w-full rounded-full bg-neutral-900 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Starting…" : "Start Pro — $6 a month"}
          </button>
          {busy && (
            <p className="mt-2 text-center text-[13px] text-neutral-400">
              taking you to secure checkout…
            </p>
          )}
          {error && <p className="mt-2 text-center text-[12px] text-red-600">{error}</p>}
          <p className="mt-2 text-center text-[11.5px] text-neutral-500">
            Cancel in one tap. Notes run to month's end.
          </p>

          <div className="my-4 border-t border-white/70" />

          <button
            type="button"
            onClick={onClose}
            className="w-full text-[13.5px] font-semibold text-neutral-500 transition-colors hover:text-neutral-900"
          >
            No thanks — keep using it free
          </button>
          <p className="mt-1 text-center text-[11.5px] text-neutral-400">
            Your three notes keep running either way.
          </p>
        </div>
      </div>
    </div>
  );
}
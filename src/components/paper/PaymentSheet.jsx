import React, { useState } from "react";
import { base44 } from "@/api/base44Client";

// The payment sheet (12b) — a modal over the page, never a route change.
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
      style={{ background: "rgba(30,22,14,.42)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[22px] sm:w-[420px] sm:rounded-[22px]"
        style={{ background: "var(--paper-card)", boxShadow: "0 40px 80px -30px rgba(30,22,14,.7)" }}
      >
        <div className="mx-auto mt-[10px] h-[4px] w-[38px] rounded-full sm:hidden" style={{ background: "rgba(60,45,25,.2)" }} />
        <div className="p-5">
          <p className="font-mono text-[9.5px] tracking-[0.18em]" style={{ color: "rgba(60,45,25,.55)" }}>
            AGENT BUDDY PRO
          </p>
          <p className="mt-2">
            <span className="font-display text-[25px] font-semibold text-ink-warm">$6</span>{" "}
            <span className="text-[13.5px]" style={{ color: "rgba(40,30,20,.65)" }}>
              a month
            </span>
          </p>
          <p className="mt-2 text-[14px] leading-snug text-ink-warm">
            Unlimited notes, everyone you look after, weekly page of your book.
          </p>

          <button
            type="button"
            onClick={startPro}
            disabled={busy}
            className="mt-5 w-full rounded-full bg-terracotta py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Starting…" : "Start Pro — $6 a month"}
          </button>
          {busy && (
            <p className="mt-2 text-center font-hand text-[16px]" style={{ color: "rgba(60,45,25,.6)" }}>
              taking you to secure checkout…
            </p>
          )}
          {error && <p className="mt-2 text-center text-[12px]" style={{ color: "oklch(0.45 0.15 25)" }}>{error}</p>}
          <p className="mt-2 text-center text-[11.5px]" style={{ color: "rgba(60,45,25,.6)" }}>
            Cancel in one tap. Notes run to month's end.
          </p>

          <div className="my-4 border-t border-hairline" />

          <button
            type="button"
            onClick={onClose}
            className="w-full text-[13.5px] font-semibold transition-colors hover:text-ink-warm"
            style={{ color: "rgba(40,30,20,.65)" }}
          >
            No thanks — keep using it free
          </button>
          <p className="mt-1 text-center text-[11.5px]" style={{ color: "rgba(60,45,25,.55)" }}>
            Your three notes keep running either way.
          </p>
        </div>
      </div>
    </div>
  );
}
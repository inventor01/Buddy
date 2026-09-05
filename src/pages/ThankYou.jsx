import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";

// Where the buyer lands after paying. Pro turns on from the payments
// webhook, which can arrive moments after the redirect — poll for it.
export default function ThankYou() {
  const [state, setState] = useState("checking"); // checking | on | slow

  useEffect(() => {
    let tries = 0;
    let timer;
    const poll = async () => {
      tries += 1;
      try {
        const me = await base44.auth.me();
        if (me?.plan === "pro") {
          setState("on");
          return;
        }
      } catch (_) {
        /* not signed in yet or session warming up — keep polling */
      }
      if (tries >= 12) {
        setState("slow");
        return;
      }
      timer = setTimeout(poll, 2500);
    };
    poll();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-6" style={{ background: "var(--paper)" }}>
      <div className="w-full max-w-[420px] text-center">
        {state === "checking" && (
          <>
            <p className="font-hand text-[26px] text-ink-warm">Confirming your payment…</p>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-[13px]" style={{ color: "rgba(60,45,25,.6)" }}>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--terracotta)" }} />
              Pro turns on the moment your payment lands.
            </p>
          </>
        )}
        {state === "on" && (
          <>
            <p className="font-mono text-[10px] tracking-[0.18em]" style={{ color: "var(--leaf)" }}>
              PRO IS ON
            </p>
            <p className="mt-3 font-hand text-[30px] leading-tight text-ink-warm">
              Write as many notes as you like.
            </p>
            <Link
              to="/"
              className="mt-6 inline-block rounded-full px-6 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--ink-warm)" }}
            >
              Back to your notes
            </Link>
          </>
        )}
        {state === "slow" && (
          <>
            <p className="font-hand text-[26px] text-ink-warm">It's taking a moment.</p>
            <p className="mt-2 text-[13px]" style={{ color: "rgba(60,45,25,.6)" }}>
              Your Pro turns on automatically — head back to your notes and it will be there.
            </p>
            <Link
              to="/"
              className="mt-6 inline-block rounded-full px-6 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--ink-warm)" }}
            >
              Back to your notes
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
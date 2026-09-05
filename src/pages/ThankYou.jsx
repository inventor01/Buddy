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
    <div className="page-glow flex min-h-screen items-center justify-center px-6">
      <div className="glass w-full max-w-[420px] rounded-[24px] p-8 text-center">
        {state === "checking" && (
          <>
            <p className="font-heading text-[24px] font-semibold tracking-tight text-neutral-900">
              Confirming your payment…
            </p>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-[13px] text-neutral-500">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Pro turns on the moment your payment lands.
            </p>
          </>
        )}
        {state === "on" && (
          <>
            <p className="font-mono text-[10px] tracking-[0.18em] text-emerald-600">PRO IS ON</p>
            <p className="mt-3 font-heading text-[28px] font-semibold leading-tight tracking-tight text-neutral-900">
              Write as many notes as you like.
            </p>
            <Link
              to="/"
              className="mt-6 inline-block rounded-full bg-neutral-900 px-6 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              Back to your notes
            </Link>
          </>
        )}
        {state === "slow" && (
          <>
            <p className="font-heading text-[24px] font-semibold tracking-tight text-neutral-900">
              It's taking a moment.
            </p>
            <p className="mt-2 text-[13px] text-neutral-500">
              Your Pro turns on automatically — head back to your notes and it will be there.
            </p>
            <Link
              to="/"
              className="mt-6 inline-block rounded-full bg-neutral-900 px-6 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              Back to your notes
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
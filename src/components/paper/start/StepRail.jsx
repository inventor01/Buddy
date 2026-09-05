import React from "react";

// The five-step progress line — friendly circles on a thread, with a
// warm gold glow on the step you're on. Never feels like a form.
export default function StepRail({ steps, current }) {
  return (
    <div className="mx-auto max-w-[760px] px-6 pt-9">
      <div className="relative flex items-start justify-between">
        <div
          className="absolute left-[10%] right-[10%] top-[8px] h-[2px]"
          style={{ background: "var(--hairline)" }}
        />
        {steps.map((label, i) => {
          const n = i + 1;
          const state = n === current ? "current" : n < current ? "done" : "upcoming";
          return (
            <div key={label} className="relative flex w-[19%] flex-col items-center gap-2">
              <span
                className="flex h-[18px] w-[18px] items-center justify-center rounded-full"
                style={{
                  background:
                    state === "upcoming"
                      ? "#fff"
                      : state === "done"
                      ? "rgba(232,163,61,.55)"
                      : "var(--amber-cta)",
                  border: state === "upcoming" ? "2px solid rgba(60,45,25,.16)" : "none",
                  boxShadow:
                    state === "current"
                      ? "0 0 0 7px rgba(232,163,61,.22)"
                      : state === "upcoming"
                      ? "0 1px 3px rgba(60,45,25,.08)"
                      : "none",
                }}
              />
              <span
                className="text-center text-[11px] font-medium"
                style={{ color: state === "current" ? "var(--ink-warm)" : "rgba(60,45,25,.5)" }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
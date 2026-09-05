import React from "react";

// Dark workshop header — brand on the left, Try Pro in workshop gold.
// Local to the builder page so the rest of the app keeps its own header.
export default function WorkshopHeader({ authed, onTryPro, onSignIn }) {
  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur-md"
      style={{ background: "rgba(22,22,34,.78)", borderColor: "rgba(64,64,96,.5)" }}
    >
      <div className="mx-auto flex h-14 max-w-[880px] items-center justify-between px-5 sm:px-8">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[15px] font-semibold tracking-tight" style={{ color: "#F0F0F0" }}>
            Agent Buddy
          </span>
          <span className="hidden text-[12px] sm:inline" style={{ color: "rgba(160,160,192,.75)" }}>
            the night workshop
          </span>
        </div>
        <div className="flex items-center gap-3">
          {authed === false && (
            <button
              type="button"
              onClick={onSignIn}
              className="text-[13px] font-medium"
              style={{ color: "rgba(160,160,192,.85)" }}
            >
              Sign in
            </button>
          )}
          <button
            type="button"
            onClick={onTryPro}
            className="rounded-full px-4 py-1.5 text-[12.5px] font-semibold"
            style={{ background: "#FFC675", color: "#2B2113" }}
          >
            Try Pro
          </button>
        </div>
      </div>
    </header>
  );
}
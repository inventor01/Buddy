import React from "react";
import { Link } from "react-router-dom";

// The shared top menu — used by the home page and onboarding.
// Wordmark + handwritten tagline on the left, quiet nav and the
// terracotta Try Pro pill on the right.
export default function TopMenu({ onTryPro, onBook, authed = true, onSignIn }) {
  return (
    <header
      className="sticky top-0 z-30 border-b border-hairline"
      style={{ background: "rgba(255,255,255,.6)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <div className="flex items-baseline gap-2.5">
          <Link to="/" className="font-display text-[16px] font-semibold tracking-[-0.02em] text-ink-warm">
            Buddy
          </Link>
          <span className="hidden font-hand text-[13px] sm:inline" style={{ color: "rgba(40,30,20,.6)" }}>
            notes that do things
          </span>
        </div>
        <nav className="flex items-center gap-0.5 text-[13px] font-medium" style={{ color: "rgba(40,30,20,.72)" }}>
          <Link to="/start" className="hidden rounded-full px-3 py-2 transition-colors hover:text-ink-warm sm:block">
            What notes can do
          </Link>
          {authed ? (
            <button
              type="button"
              onClick={onBook}
              className="hidden rounded-full px-3 py-2 transition-colors hover:text-ink-warm sm:block"
            >
              Your book
            </button>
          ) : (
            onSignIn && (
              <button
                type="button"
                onClick={onSignIn}
                className="rounded-full px-3 py-2 transition-colors hover:text-ink-warm"
              >
                Sign in
              </button>
            )
          )}
          <button
            type="button"
            onClick={onTryPro}
            className="hidden rounded-full px-3 py-2 transition-colors hover:text-ink-warm sm:block"
          >
            $6 a month
          </button>
          <button
            type="button"
            onClick={onTryPro}
            className="rounded-full bg-terracotta px-[17px] py-2 font-semibold text-white transition-opacity hover:opacity-90"
          >
            Try Pro
          </button>
        </nav>
      </div>
    </header>
  );
}
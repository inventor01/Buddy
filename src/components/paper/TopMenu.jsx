import React from "react";
import { Link } from "react-router-dom";
import { Settings } from "lucide-react";

// The shared top menu — a strip of liquid glass floating over the wash.
export default function TopMenu({ onBook, authed = true, onSignIn = null }) {
  return (
    <header
      className="sticky top-0 z-30 border-b border-white/60"
      style={{
        background: "rgba(255,255,255,.55)",
        backdropFilter: "blur(22px) saturate(1.7)",
        WebkitBackdropFilter: "blur(22px) saturate(1.7)",
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <Link
          to="/"
          className="font-display text-[16px] font-semibold tracking-tight text-neutral-900"
        >
          Buddy
        </Link>
        <nav className="flex items-center gap-0.5 text-[13px] font-medium text-neutral-600">
          <Link
            to="/start"
            className="hidden rounded-full px-3 py-2 transition-colors hover:text-neutral-900 sm:block"
          >
            What notes can do
          </Link>
          {authed ? (
            <>
              <button
                type="button"
                onClick={onBook}
                className="hidden rounded-full px-3 py-2 transition-colors hover:text-neutral-900 sm:block"
              >
                Your book
              </button>
              <Link
                to="/settings"
                className="hidden rounded-full px-2 py-2 transition-colors hover:text-neutral-900 sm:flex items-center"
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
              </Link>
            </>
          ) : (
            onSignIn && (
              <button
                type="button"
                onClick={onSignIn}
                className="rounded-full px-3 py-2 transition-colors hover:text-neutral-900"
              >
                Sign in
              </button>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
import React from "react";

const URL_SPLIT = /(https?:\/\/[^\s)]+)/;

// Renders plain text, turning any URL in it into a real link — so the
// source that came with a finding is always clickable proof of work.
export default function LinkedText({ children }) {
  const text = typeof children === "string" ? children : "";
  if (!text) return null;
  const parts = text.split(URL_SPLIT);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("http") ? (
          <a
            key={i}
            href={p}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all underline decoration-neutral-400/60 underline-offset-2 transition-colors hover:decoration-neutral-900"
          >
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}
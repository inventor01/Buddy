import React from "react";

// The two hand-drawn icons from the approved reference (10a rail).
// Verbatim paths — do not substitute icon-library glyphs.

export function PencilIcon({ size = 15, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M16.8 3.4c.9-.8 2.1-.6 3 .3.9.9 1 2.1.2 2.9L8.6 18.3l-4.2 1.5 1.4-4.3L16.8 3.4Z" />
      <path d="M15.2 5.1c1 .5 2.3 1.7 2.9 2.9" />
      <path d="M5.9 15.4c1 .5 2.2 1.7 2.8 2.9" />
    </svg>
  );
}

export function BookIcon({ size = 16, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 6.4C10.3 5.1 7.6 4.5 4.2 4.8c-.5 0-.7.3-.7.8.2 3.9.2 7.8 0 11.7 0 .5.3.8.8.8 3.2-.2 5.8.3 7.7 1.5" />
      <path d="M12 6.4c1.7-1.3 4.4-1.9 7.8-1.6.5 0 .7.3.7.8-.2 3.9-.2 7.8 0 11.7 0 .5-.3.8-.8.8-3.2-.2-5.8.3-7.7 1.5" />
      <path d="M12 6.6v13" />
    </svg>
  );
}
import React, { useEffect, useState } from "react";

// The rotating word in the headline — types a word out, holds it, deletes
// it, then types the next one. A thin caret keeps the chat-like feel.

const WORDS = ["organization", "automation", "reminders", "peace of mind"];

export default function TypingWord() {
  const [index, setIndex] = useState(0);
  const [len, setLen] = useState(0);
  const [phase, setPhase] = useState("typing"); // typing → holding → deleting

  useEffect(() => {
    const word = WORDS[index];
    let t;
    if (phase === "typing") {
      if (len < word.length) {
        t = setTimeout(() => setLen(len + 1), 68 + (len % 3) * 14);
      } else {
        t = setTimeout(() => setPhase("deleting"), 2200);
      }
    } else {
      if (len > 0) {
        t = setTimeout(() => setLen(len - 1), 42);
      } else {
        t = setTimeout(() => {
          setIndex((i) => (i + 1) % WORDS.length);
          setPhase("typing");
        }, 350);
      }
    }
    return () => clearTimeout(t);
  }, [phase, len, index]);

  return (
    <span className="whitespace-nowrap">
      {WORDS[index].slice(0, len)}
      <span className="ml-[3px] inline-block h-[0.78em] w-[2px] translate-y-[0.04em] animate-pulse rounded-full bg-neutral-400" />
    </span>
  );
}
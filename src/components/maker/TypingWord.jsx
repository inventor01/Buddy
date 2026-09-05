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
        t = setTimeout(() => setLen(len + 1), 75);
      } else {
        t = setTimeout(() => setPhase("deleting"), 2400);
      }
    } else {
      if (len > 0) {
        t = setTimeout(() => setLen(len - 1), 38);
      } else {
        t = setTimeout(() => {
          setIndex((i) => (i + 1) % WORDS.length);
          setPhase("typing");
        }, 300);
      }
    }
    return () => clearTimeout(t);
  }, [phase, len, index]);

  return (
    <span className="relative inline-block align-bottom">
      <span className="invisible">{WORDS.reduce((a, b) => (b.length > a.length ? b : a))}</span>
      <span className="absolute left-0 top-0">{WORDS[index].slice(0, len)}</span>
      <span
        className="absolute top-[0.12em] ml-[1px] inline-block w-[2px] animate-pulse bg-neutral-900"
        style={{ height: "0.8em" }}
      />
    </span>
  );
}
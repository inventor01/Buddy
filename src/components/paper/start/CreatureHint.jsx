import React from "react";
import BuddyCreature from "@/components/buddy/BuddyCreature";

// The little garden creature sits in the corner of the card, pointing at
// where you write — with a "just tap here instead" for anyone who'd
// rather tap than anything else.
export default function CreatureHint({ onJustTap }) {
  return (
    <div className="flex flex-col items-center">
      <BuddyCreature variant="sam" size={84} />
      <button
        type="button"
        onClick={onJustTap}
        className="-mt-2 rounded-full px-2 text-[12.5px] font-medium underline underline-offset-4"
        style={{ color: "rgba(60,45,25,.55)" }}
      >
        or just tap here instead
      </button>
    </div>
  );
}
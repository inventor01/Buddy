import React, { useRef, useState } from "react";
import { ArrowRight, ImagePlus, Loader2, Mic, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";

// The composer — one question, one plain sentence, and the note goes off
// to do the thing. Suggestion pills fill the input; they don't submit.
// A photo can ride along too — the note hunts for that exact thing daily.
const BUDDY_REQUEST_MAX = 8000;

const SUGGESTIONS = [
  "Find me the best nonstop flight to Miami next month under $300",
  "Tell me when a PS6 preorder opens at a major retailer",
  "Compare three well-rated plumbers near me",
  "Plan a birthday dinner for 8 people under $250",
];

export default function Composer({ onPin, busy, buddies = [] }) {
  const [note, setNote] = useState("");
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const canListen =
    typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const mentionMatch = note.match(/(?:^|\s)@([^\s\[]*)$/);
  const mentionQuery = mentionMatch ? String(mentionMatch[1] || "").toLowerCase() : null;
  const mentionChoices = mentionQuery === null
    ? []
    : buddies
        .filter((b) => b?.name && String(b.name).toLowerCase().includes(mentionQuery))
        .slice(0, 6);

  const insertMention = (buddyName) => {
    setNote((current) => current.replace(/(^|\s)@[^\s\[]*$/, (_, lead) => `${lead}@[${buddyName}] `));
  };

  const listen = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    try {
      const rec = new SR();
      rec.lang = "en-US";
      rec.onresult = (e) => setNote(e.results?.[0]?.[0]?.transcript || "");
      rec.start();
    } catch (_) {
      /* voice isn't available on this browser — the button hides itself */
    }
  };

  const attach = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || uploading) return;
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      setImage(res.file_url);
    } catch (_) {
      /* nothing attached — they can try again */
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!note.trim() || busy) return;
    try {
      await onPin(note, image);
      setNote("");
      setImage(null);
    } catch (_) {
      /* the page already showed the error — keep the note so they can retry */
    }
  };

  return (
    <div className="mx-auto max-w-[640px]">
      <h2 className="font-heading text-[26px] font-semibold tracking-tight text-neutral-900">
        What do you want off your plate?
      </h2>

      <div className="glass mt-5 rounded-[20px] p-4">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={BUDDY_REQUEST_MAX}
          placeholder="Tell Buddy what you want handled…"
          className="w-full resize-none bg-transparent px-1 text-[16px] leading-snug text-neutral-900 outline-none placeholder:text-neutral-400"
        />
        {mentionChoices.length > 0 && (
          <div className="mb-2 rounded-2xl border border-white/80 bg-white/90 p-1.5 shadow-sm backdrop-blur-xl">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Connect another thing</p>
            {mentionChoices.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => insertMention(b.name)}
                className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-[13px] text-neutral-700 hover:bg-neutral-50"
              >
                <span className="truncate font-medium">@{b.name}</span>
                <span className="ml-3 shrink-0 text-[10.5px] text-neutral-400">use this chat</span>
              </button>
            ))}
          </div>
        )}
        {image && (
          <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-white/70 bg-white/60 p-2">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/70">
              <Image src={image} className="h-full w-full" fittingType="fill" />
            </div>
            <span className="text-[12px] leading-snug text-neutral-500">
              Photo attached — it'll hunt for this thing every day
            </span>
            <button
              type="button"
              onClick={() => setImage(null)}
              className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded-full text-neutral-400 transition-colors hover:bg-white/70 hover:text-neutral-700"
              aria-label="Remove photo"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden font-mono text-[9.5px] tracking-[0.14em] text-neutral-400 sm:inline">
              YOU’LL SEE HOW IT PLANS TO HANDLE IT FIRST
            </span>
            <span className="shrink-0 text-[10px] tabular-nums text-neutral-400" aria-label={`${note.length} of ${BUDDY_REQUEST_MAX} characters used`}>
              {note.length.toLocaleString()}/{BUDDY_REQUEST_MAX.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={attach}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="grid h-9 w-9 place-items-center rounded-full text-neutral-400 transition-colors hover:bg-white/60 hover:text-neutral-600 disabled:opacity-50"
              aria-label="Add a photo"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            </button>
            {canListen && (
              <button
                type="button"
                onClick={listen}
                className="grid h-9 w-9 place-items-center rounded-full text-neutral-400 transition-colors hover:bg-white/60 hover:text-neutral-600"
                aria-label="Say it out loud"
              >
                <Mic className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={busy || !note.trim()}
              className="grid h-9 w-9 place-items-center rounded-full bg-neutral-900 text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              aria-label="Pin it up"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setNote(s)}
            className="rounded-full border border-white/70 bg-white/45 px-3.5 py-1.5 text-[12.5px] text-neutral-700 transition-colors hover:bg-white/75"
          >
            {s}
          </button>
        ))}
      </div>

      <p className="mt-6 text-[13px] text-neutral-500">
        Write it like you’d text a friend. Type <span className="font-medium text-neutral-700">@</span> to connect another Buddy chat, or describe several steps and Buddy will carry the result from one step into the next.
      </p>
    </div>
  );
}
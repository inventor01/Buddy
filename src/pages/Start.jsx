import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUp, Check, ImagePlus, Loader2, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { useToast } from "@/components/ui/use-toast";
import PaymentSheet from "@/components/paper/PaymentSheet";
import PlanBoard from "@/components/maker/PlanBoard";
import FoundIt from "@/components/maker/FoundIt";
import TypingWord from "@/components/maker/TypingWord";

// One box, like a chat window — but what you type becomes a small set of
// cards you can drag and reword before it runs. Simple enough for anyone,
// quiet enough for a big company. No jargon on the screen, ever.

const EXAMPLES = [
  { label: "Bills on time", text: "Three days before my electric bill is due, text me a nudge" },
  { label: "Expiring coupons", text: "When my coupons are about to expire, tell me which ones still work" },
  { label: "Birthday nudges", text: "A week before anyone's birthday, text me a nudge" },
  { label: "Price drops", text: "When chicken drops under $1.50, text me" },
];

const CATS = ["when", "what", "tells"];

export default function Start() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState("compose"); // compose → plan → ran → phone → done
  const [note, setNote] = useState("");
  const [image, setImage] = useState(null); // uploaded photo that rides along
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const [lines, setLines] = useState(null); // { when, what, tells, name, creature, scheduleTime }
  const [order, setOrder] = useState(CATS);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { text, source }
  const [createdId, setCreatedId] = useState(null);
  const [phone, setPhone] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [authed, setAuthed] = useState(null); // null while checking

  // No account needed to try it — things only get saved once someone is
  // signed in.
  useEffect(() => {
    base44.auth.isAuthenticated().then(setAuthed).catch(() => setAuthed(false));
  }, []);

  // Attach a photo — it rides along and gets hunted down like a reverse
  // image search every day.
  const attach = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || uploading) return;
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      setImage(res.file_url);
    } catch (_) {
      toast({ title: "That photo didn't upload — try again.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // Read the sentence back as when / what / tells cards.
  const toPlan = async () => {
    if (!note.trim() || busy) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke("createBuddyFromNote", {
        note: note.trim(),
        image_url: image || undefined,
      });
      const plan = res.data?.plan;
      if (!plan) throw new Error("It couldn't read that — try again.");
      setLines({
        when: plan.when_line,
        what: plan.what_line,
        tells: plan.how_line,
        name: plan.name,
        creature: plan.creature,
        scheduleTime: plan.schedule_time,
      });
      setOrder(CATS);
      setEditing(null);
      setStep("plan");
    } catch (e) {
      toast({ title: e.message || "It couldn't read that — try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const reorder = (s, d) =>
    setOrder((o) => {
      const next = [...o];
      const [moved] = next.splice(s, 1);
      next.splice(d, 0, moved);
      return next;
    });

  const changeLine = (cat, v) => setLines((l) => ({ ...l, [cat]: v }));

  const runOnce = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (authed === false) {
        // Visitor with no account: run it once, save nothing.
        let found = null;
        let foundItems = null;
        try {
          const res = await base44.functions.invoke("previewBuddyRun", {
            note: note.trim(),
            what: lines.what,
            image_url: image || undefined,
          });
          const ls = res.data?.lines || [];
          if (ls.length) {
            found = ls;
            foundItems = res.data?.items || null;
          }
        } catch (_) {
          /* the fallback below covers it */
        }
        setResult(
          found
            ? { text: found.join("\n"), source: "What it read from the web just now", items: foundItems }
            : { text: "It couldn't reach the page just now. It'll try again in the morning.", source: null }
        );
        setStep("ran");
        return;
      }

      // Recompute the real settings from the (possibly reworded) cards:
      // WHEN → the daily schedule it runs on, TELLS → the channel.
      let scheduleTime = lines.scheduleTime || "9:00 AM";
      try {
        const rec = await base44.functions.invoke("recompilePlan", {
          when_line: lines.when,
          what_line: lines.what,
          how_line: lines.tells,
        });
        if (rec.data?.schedule_time) scheduleTime = rec.data.schedule_time;
      } catch (_) {
        /* the LLM's first reading of the schedule still stands */
      }

      const created = await base44.entities.Buddy.create({
        note: note.trim(),
        image_url: image,
        name: lines.name || "Your helper",
        creature: lines.creature || "sam",
        when_line: lines.when,
        what_line: lines.what,
        how_line: lines.tells,
        schedule_time: scheduleTime,
        status: "active",
      });
      setCreatedId(created.id);

      let found = null;
      let foundItems = null;
      try {
        const res = await base44.functions.invoke("runBuddyNow", { buddyId: created.id });
        const ls = res.data?.lines || [];
        if (ls.length) {
          found = ls;
          foundItems = res.data?.items || null;
        }
      } catch (_) {
        /* the fallback below covers it */
      }
      setResult(
        found
          ? { text: found.join("\n"), source: "What it read from the web just now", items: foundItems }
          : { text: "It couldn't reach the page just now. It'll try again in the morning.", source: null }
      );
      setStep("ran");
    } catch (e) {
      toast({ title: "Something went wrong — try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const pinPhone = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const raw = phone.trim();
      if (raw) {
        // Normalise: if the user typed digits only (no +), prepend +1 (US).
        // If they already typed a country code starting with +, use as-is.
        const normalised = raw.startsWith('+') ? raw : '+1' + raw.replace(/\D/g, '');
        await base44.auth.updateMe({ sms_phone: normalised });
      }
      setStep("done");
    } catch (_) {
      setStep("done");
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setNote("");
    setImage(null);
    setLines(null);
    setOrder(CATS);
    setEditing(null);
    setResult(null);
    setCreatedId(null);
    setStep("compose");
  };

  const primary =
    "inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-[14px] font-medium text-white transition-all hover:bg-neutral-800 disabled:opacity-40";
  const outline =
    "inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-[14px] font-medium text-neutral-700 hover:border-neutral-400";
  const ghost = "text-[13.5px] font-medium text-neutral-500 transition-colors hover:text-neutral-800";
  const card = "glass rounded-[24px] p-6 sm:p-8";
  const kicker = "text-[10.5px] font-semibold uppercase tracking-[0.2em] text-neutral-400";
  const h2 = "font-heading text-[26px] font-semibold tracking-tight text-neutral-900 sm:text-[30px]";

  return (
    <div className="page-glow min-h-screen">
      <header
        className="sticky top-0 z-30 border-b border-white/60"
        style={{
          background: "rgba(255,255,255,.55)",
          backdropFilter: "blur(22px) saturate(1.7)",
          WebkitBackdropFilter: "blur(22px) saturate(1.7)",
        }}
      >
        <div className="relative mx-auto flex h-14 max-w-[720px] items-center justify-between px-5">
          <Link
            to="/"
            className="absolute left-1/2 -translate-x-1/2 font-heading text-[15px] font-semibold tracking-tight text-neutral-900 sm:relative sm:left-auto sm:translate-x-0"
          >
            Buddy
          </Link>
          <div className="flex items-center gap-3">
            {authed === false && (
              <button
                type="button"
                onClick={() => base44.auth.redirectToLogin("/start")}
                className="text-[13px] font-medium text-neutral-600"
              >
                Sign in
              </button>
            )}
            {authed === true && (
              <button
                type="button"
                onClick={() => navigate("/")}
                className="text-[13px] font-medium text-neutral-600"
              >
                My things
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[640px] px-5 pb-14 pt-12 sm:pt-16">
        {step === "compose" && (
          <div>
            <div className="text-center">
              <h1 className="font-heading text-[34px] font-semibold leading-[1.08] tracking-[-0.02em] text-neutral-900 sm:text-[44px]">
                Your life needs <TypingWord /> This is where it starts.
              </h1>
              <p className="mx-auto mt-3.5 max-w-[460px] text-[15.5px] leading-relaxed text-neutral-500">
                Stop putting plans in your calendar and forgetting about them. Say it once —
                bills to pay, coupons about to expire, dates that sneak up — and it checks every
                day, texting you right when it matters.
              </p>
            </div>

            <div className="glass mt-8 rounded-[22px] p-2.5">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={300}
                placeholder="Three days before my electric bill is due, text me…"
                className="w-full resize-none bg-transparent px-3 pt-2.5 text-[16px] leading-relaxed text-neutral-900 outline-none placeholder:text-neutral-400"
              />
              {image && (
                <div className="mx-1.5 mb-1 flex items-center gap-2.5 rounded-xl border border-white/70 bg-white/60 p-2">
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
              <div className="flex items-center justify-between px-1.5 pb-1 pt-1.5">
                <div className="flex items-center gap-1">
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
                  <span className="text-[11.5px] text-neutral-400">No account needed</span>
                </div>
                <button
                  type="button"
                  onClick={toPlan}
                  disabled={!note.trim() || busy}
                  className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-[13.5px] font-medium text-white disabled:opacity-40"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                  {busy ? "Reading…" : "Set it going"}
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {EXAMPLES.map((e) => (
                <button
                  key={e.label}
                  type="button"
                  onClick={() => setNote(e.text)}
                  className="rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-[12.5px] text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900"
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "plan" && lines && (
          <div className={card}>
            <p className={kicker}>What you said</p>
            <p className="mt-1.5 font-heading text-[19px] leading-snug text-neutral-900">{note}</p>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
              <p className={kicker}>Here's the plan</p>
              <p className="text-[11.5px] text-neutral-400">Drag to arrange · tap the pencil to reword</p>
            </div>
            <div className="mt-3">
              <PlanBoard
                order={order}
                lines={lines}
                editing={editing}
                onReorder={reorder}
                onEdit={(c) => setEditing(editing === c ? null : c)}
                onChange={changeLine}
                onCommit={() => setEditing(null)}
              />
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <button type="button" onClick={runOnce} disabled={busy} className={primary}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {busy ? "Checking…" : "Run it once now"}
              </button>
              <button type="button" onClick={() => setStep("compose")} className={ghost}>
                Change the words
              </button>
            </div>
          </div>
        )}

        {step === "ran" && result && (
          <FoundIt result={result} onContinue={() => setStep("phone")} onRestart={restart} />
        )}

        {step === "phone" && (
          <div className={card}>
            <p className={kicker}>Last piece</p>
            <h2 className={`mt-3 ${h2}`}>Where should we text you?</h2>
            <p className="mt-2 text-[14px] text-neutral-500">
              One number — that's the whole setup. Nothing else to connect.
            </p>
            <div className="mt-5 flex items-stretch rounded-xl border border-neutral-300 bg-white focus-within:border-neutral-500">
              <span className="grid place-items-center px-4 text-[16px] text-neutral-400">+1</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="555 123 4567"
                className="flex-1 bg-transparent py-3.5 pr-4 text-[16px] text-neutral-900 outline-none placeholder:text-neutral-400"
              />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <button type="button" onClick={pinPhone} disabled={busy} className={primary}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Start it
              </button>
              <button type="button" onClick={() => setStep("ran")} className={ghost}>
                Back
              </button>
            </div>
            <p className="mt-4 text-[12.5px] text-neutral-400">
              Only this one texts you. Nothing else, ever — and "stop" ends it in one word.
            </p>
          </div>
        )}

        {step === "done" && (
          <div className={`${card} text-center`}>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50">
              <Check className="h-5 w-5 text-emerald-600" />
            </span>
            <h2 className={`mt-4 ${h2}`}>That's one less thing.</h2>
            <p className="mx-auto mt-2 max-w-[420px] text-[14px] leading-relaxed text-neutral-500">
              It runs every day, quietly — you'll hear about it only when there's news. Most
              people start a second one within the hour.
            </p>
            <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-left">
              <p className="text-[14px] text-neutral-900">Three are free, forever.</p>
              <p className="mt-1 text-[14px] text-neutral-500">
                Unlimited is $6 a month — everyone you look after included. Cancel anytime.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setPayOpen(true)} className={primary}>
                  Go unlimited
                </button>
                <button type="button" onClick={restart} className={outline}>
                  Start another
                </button>
                {authed !== false && createdId && (
                  <button
                    type="button"
                    onClick={() => navigate(`/?note=${createdId}`)}
                    className={ghost}
                  >
                    Open it
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="pb-9 text-center text-[12px] text-neutral-400">
        Buddy · © {new Date().getFullYear()}
      </footer>

      <PaymentSheet open={payOpen} onClose={() => setPayOpen(false)} />
    </div>
  );
}
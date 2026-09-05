import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import TopMenu from "@/components/paper/TopMenu";
import StickyNote from "@/components/paper/StickyNote";
import PaymentSheet from "@/components/paper/PaymentSheet";

// Onboarding (11a) — value before account. Five steps: ask, check,
// watch it run, where to text you, keep going. Examples carry their
// own approved lines; a typed note gets its own from the same reader
// the app uses everywhere.
const STEPS = ["Ask", "Check", "Watch it run", "Where to text you", "Keep going"];

const EXAMPLES = [
  {
    chip: "Watch a price for me",
    title: "Cheap chicken",
    creature: "sam",
    note: "Watch for chicken thighs under $1.50 and text me",
    when: "Every morning at 7",
    what: "Checks Kroger, HEB and Aldi",
    tells: "Texts you — only when it's actually cheaper",
    scheduleTime: "7:00 AM",
    found: "$1.29/lb at Kroger on Fry Rd. Lowest since March.",
    source: "Read from kroger.com weekly ad, 7:02 AM today",
    next: "Warn me a week before anything renews",
  },
  {
    chip: "Remind someone I look after",
    title: "Pills at eight",
    creature: "bells",
    note: "Remind Mom about her pills at eight, and tell me she saw it",
    when: "Every day at 8:00 AM",
    what: "Texts Mom, waits for a reply",
    tells: "Texts you either way — reply or no reply",
    scheduleTime: "8:00 AM",
    found: "Mom replied \"ok honey\" at 8:04. She's seen it.",
    source: "Her reply, forwarded — nothing invented",
    next: "Tell me if Dad's appointment ever moves",
  },
  {
    chip: "Watch a page that never updates",
    title: "Permit page",
    creature: "sid",
    note: "Watch the permit page and tell me the day it opens",
    when: "Every morning at 6",
    what: "Loads the page and reads the status line",
    tells: "Texts you the day it changes — silence until then",
    scheduleTime: "6:00 AM",
    found: "Still closed today. I'll keep checking — I'll only text on a change.",
    source: "Read from the county permits page, 6:04 AM today",
    next: "Grab a passport slot the second one opens",
  },
  {
    chip: "Catch money leaving my account",
    title: "Renewals",
    creature: "med",
    note: "Warn me a week before anything renews",
    when: "Every day, quietly",
    what: "Reads renewal notices in your inbox",
    tells: "Texts you 7 days out with the cancel link",
    scheduleTime: "7:00 AM",
    found: "Storage plan renews Aug 20 at $59 — up from $39. Cancel link ready.",
    source: "Read from one email in your inbox, Aug 13",
    next: "Watch a price for me too",
  },
];

export default function Start() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [ex, setEx] = useState(null);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState(null); // { when, what, tells, name, creature, scheduleTime }
  const [editingLine, setEditingLine] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { text, source }
  const [createdId, setCreatedId] = useState(null);
  const [phone, setPhone] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [authed, setAuthed] = useState(null); // null while checking

  // Sign-in is only asked when they pin or run a note — never on arrival.
  // Their note is kept across the sign-in and the flow resumes right here.
  useEffect(() => {
    let alive = true;
    base44.auth
      .isAuthenticated()
      .then((ok) => {
        if (!alive) return;
        setAuthed(ok);
        if (ok) {
          try {
            const stash = JSON.parse(sessionStorage.getItem("agentbuddy_flow") || "null");
            sessionStorage.removeItem("agentbuddy_flow");
            if (stash?.note) {
              setNote(stash.note);
              if (stash.exKey) {
                const e = EXAMPLES.find((x) => x.chip === stash.exKey);
                if (e) {
                  setEx(e);
                  setLines({ when: e.when, what: e.what, tells: e.tells });
                  setStep(stash.step || 2);
                }
              }
            }
          } catch (_) {
            /* nothing to resume */
          }
        }
      })
      .catch(() => alive && setAuthed(false));
    return () => {
      alive = false;
    };
  }, []);

  const stashFlow = (nextStep) => {
    try {
      sessionStorage.setItem(
        "agentbuddy_flow",
        JSON.stringify({ note: note.trim(), exKey: ex?.chip, step: nextStep })
      );
    } catch (_) {
      /* private browsing — the sign-in still proceeds */
    }
  };

  const pickExample = (e) => {
    setEx(e);
    setNote(e.note);
    setLines({ when: e.when, what: e.what, tells: e.tells });
    setStep(2);
  };

  const typedNext = async () => {
    if (!note.trim() || busy) return;
    if (authed === false) {
      stashFlow(1);
      base44.auth.redirectToLogin("/start");
      return;
    }
    setBusy(true);
    try {
      const res = await base44.functions.invoke("createBuddyFromNote", { note: note.trim() });
      const plan = res.data?.plan;
      if (!plan) throw new Error("It couldn't read that note — try again.");
      setEx(null);
      setLines({
        when: plan.when_line,
        what: plan.what_line,
        tells: plan.how_line,
        name: plan.name,
        creature: plan.creature,
        scheduleTime: plan.schedule_time,
      });
      setStep(2);
    } catch (e) {
      toast({ title: e.message || "It couldn't read that note — try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const runOnce = async () => {
    if (busy) return;
    if (authed === false) {
      stashFlow(2);
      base44.auth.redirectToLogin("/start");
      return;
    }
    setBusy(true);
    try {
      const created = await base44.entities.Buddy.create({
        note: note.trim(),
        name: ex ? ex.title : lines.name || "Your note",
        creature: ex ? ex.creature : lines.creature || "sam",
        when_line: lines.when,
        what_line: lines.what,
        how_line: lines.tells,
        schedule_time: ex ? ex.scheduleTime : lines.scheduleTime || "9:00 AM",
        status: "active",
      });
      setCreatedId(created.id);

      if (ex) {
        setResult({ text: ex.found, source: ex.source });
        setStep(3);
      } else {
        let found = null;
        try {
          const res = await base44.functions.invoke("runBuddyNow", { buddyId: created.id });
          const ls = res.data?.lines || [];
          if (ls.length) found = ls;
        } catch (_) {
          /* the fallback below covers it */
        }
        setResult(
          found
            ? { text: found.join("\n"), source: "What it read from the web just now" }
            : { text: "It couldn't reach the page just now. It'll try again in the morning.", source: null }
        );
        setStep(3);
      }
    } catch (e) {
      toast({ title: "Something went wrong — try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const pinNote = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (phone.trim()) await base44.auth.updateMe({ sms_phone: phone.trim() });
      setStep(5);
    } catch (_) {
      setStep(5);
    } finally {
      setBusy(false);
    }
  };

  const restartWith = (text) => {
    setEx(null);
    setNote(text);
    setLines(null);
    setResult(null);
    setCreatedId(null);
    setStep(1);
  };

  const dot = (i) => {
    const n = i + 1;
    const state = n === step ? "current" : n < step ? "done" : "upcoming";
    return (
      <div key={n} className="flex flex-col items-center gap-1.5">
        <span
          className="h-3 w-3 rounded-full"
          style={{
            background: state === "current" ? "var(--ink-warm)" : state === "done" ? "var(--leaf)" : "transparent",
            border: state === "upcoming" ? "1.5px solid rgba(60,45,25,.25)" : "none",
          }}
        />
        <span
          className="hidden text-[10px] sm:block"
          style={{ color: state === "current" ? "var(--ink-warm)" : "rgba(60,45,25,.5)" }}
        >
          {STEPS[i]}
        </span>
      </div>
    );
  };

  const Row = ({ label, value, k }) => (
    <div className="border border-hairline bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[9.5px] tracking-[0.14em]" style={{ color: "rgba(60,45,25,.55)" }}>
          {label}
        </span>
        <button
          type="button"
          onClick={() => setEditingLine(editingLine === k ? null : k)}
          className="text-[12px] font-semibold"
          style={{ color: "var(--terracotta)" }}
        >
          change
        </button>
      </div>
      {editingLine === k ? (
        <input
          autoFocus
          value={value}
          onChange={(e) => setLines((l) => ({ ...l, [k]: e.target.value }))}
          onBlur={() => setEditingLine(null)}
          onKeyDown={(e) => e.key === "Enter" && setEditingLine(null)}
          className="mt-2 w-full bg-transparent text-[15.5px] text-ink-warm outline-none"
          style={{ borderBottom: "1px solid var(--hairline)" }}
        />
      ) : (
        <p className="mt-2 text-[15.5px] text-ink-warm">{value}</p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--paper)" }}>
      <TopMenu
        onTryPro={() => setPayOpen(true)}
        onBook={authed !== false ? () => navigate("/") : undefined}
        authed={authed !== false}
        onSignIn={() => base44.auth.redirectToLogin("/start")}
      />

      {/* step rail */}
      <div className="mx-auto flex max-w-[640px] items-start justify-between gap-2 px-6 pt-8">
        {STEPS.map((_, i) => dot(i))}
      </div>

      <div className="mx-auto max-w-[640px] px-6 pb-16 pt-8" style={{ minHeight: 470 }}>
        {step === 1 && (
          <div className="text-center">
            <h1 className="font-display text-[34px] font-semibold leading-[1.06] tracking-[-0.03em] text-ink-warm sm:text-[42px]">
              A note that actually does the thing.
            </h1>
            <p className="mx-auto mt-4 max-w-[560px] text-[14.5px] leading-relaxed" style={{ color: "rgba(60,45,25,.7)" }}>
              Write it in plain words — watch this price, remind Mom at eight, check that page every morning. It goes
              and does it, then texts you what it found. Think of it as a sticky note that can read the internet.
            </p>
            <p className="mt-7 font-question text-[22px]" style={{ color: "rgba(40,30,20,.75)" }}>
              So — what do you keep checking yourself?
            </p>
            <div className="mx-auto mt-5 grid max-w-[560px] grid-cols-1 gap-2.5 sm:grid-cols-2">
              {EXAMPLES.map((e) => (
                <button
                  key={e.chip}
                  type="button"
                  onClick={() => pickExample(e)}
                  className="border border-hairline bg-white px-4 py-3.5 text-left text-[14px] font-medium text-ink-warm transition-colors hover:bg-black/[0.02]"
                >
                  {e.chip}
                </button>
              ))}
            </div>
            <p className="mt-5 text-[12px]" style={{ color: "rgba(60,45,25,.55)" }}>
              Or type your own — no account yet, nothing to connect.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="Watch for chicken thighs under $1.50 and text me…"
              className="mx-auto mt-3 block w-full max-w-[560px] border border-hairline bg-white p-4 font-hand text-[19px] leading-tight text-ink-warm outline-none placeholder:opacity-40"
            />
            {note.trim() && (
              <button
                type="button"
                onClick={typedNext}
                disabled={busy}
                className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-60"
                style={{ background: "var(--ink-warm)" }}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Read it back to me
              </button>
            )}
          </div>
        )}

        {step === 2 && lines && (
          <div className="grid items-start gap-8 sm:grid-cols-[1fr_300px]">
            <div>
              <p className="font-mono text-[9.5px] tracking-[0.18em]" style={{ color: "rgba(60,45,25,.55)" }}>
                STEP 2 — READ IT BACK
              </p>
              <h2 className="mt-2 font-display text-[26px] font-semibold leading-tight text-ink-warm sm:text-[30px]">
                Here's exactly what it'll do. Change any line.
              </h2>
              <p className="mt-2 text-[13.5px]" style={{ color: "rgba(60,45,25,.6)" }}>
                No settings, no permissions screen. Three sentences — if one's wrong, tap it.
              </p>
              <div className="mt-5 grid gap-2.5">
                <Row label="WHEN" value={lines.when} k="when" />
                <Row label="WHAT" value={lines.what} k="what" />
                <Row label="TELLS" value={lines.tells} k="tells" />
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={runOnce}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-60"
                  style={{ background: "var(--ink-warm)" }}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {busy ? "checking…" : "Looks right — run it once now"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-[13px] font-medium"
                  style={{ color: "rgba(60,45,25,.6)" }}
                >
                  Back
                </button>
              </div>
            </div>
            <div className="flex justify-center sm:justify-end">
              <StickyNote id={note} caption="YOUR NOTE · NOT PINNED YET" fixedRotation={-1.6} className="w-[280px] p-5">
                {note}
              </StickyNote>
            </div>
          </div>
        )}

        {step === 3 && result && (
          <div className="mx-auto max-w-[560px]">
            <p className="font-mono text-[9.5px] tracking-[0.18em]" style={{ color: "rgba(60,45,25,.55)" }}>
              STEP 3 — IT JUST RAN
            </p>
            <h2 className="mt-2 font-display text-[26px] font-semibold leading-tight text-ink-warm sm:text-[30px]">
              Here's what it found, right now.
            </h2>
            <p className="mt-2 text-[13.5px]" style={{ color: "rgba(60,45,25,.6)" }}>
              This is the real thing, not a demo.
            </p>
            <div className="mt-6 border border-hairline bg-white p-4" style={{ borderLeft: "3px solid var(--leaf)" }}>
              <p className="font-mono text-[9.5px] tracking-[0.14em]" style={{ color: "rgba(60,45,25,.55)" }}>
                THE NOTE · JUST NOW
              </p>
              <p className="mt-2 whitespace-pre-line text-[15px] leading-snug text-ink-warm">{result.text}</p>
              {result.source && (
                <p className="mt-2 text-[11.5px]" style={{ color: "rgba(60,45,25,.6)" }}>
                  {result.source}
                </p>
              )}
            </div>
            <p
              className="mt-4 border border-dashed p-4 text-[13px]"
              style={{ borderColor: "rgba(60,45,25,.3)", color: "rgba(60,45,25,.65)" }}
            >
              It will do that every morning from now on — and stay silent on the days there's nothing worth telling
              you.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="rounded-full px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: "var(--terracotta)" }}
              >
                Keep it running
              </button>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-[13px] font-medium"
                style={{ color: "rgba(60,45,25,.6)" }}
              >
                Change the note
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="grid items-start gap-8 sm:grid-cols-[1fr_300px]">
            <div>
              <p className="font-mono text-[9.5px] tracking-[0.18em]" style={{ color: "rgba(60,45,25,.55)" }}>
                STEP 4 — ONE FIELD
              </p>
              <h2 className="mt-2 font-display text-[26px] font-semibold leading-tight text-ink-warm sm:text-[30px]">
                Where should it text you?
              </h2>
              <p className="mt-2 text-[13.5px]" style={{ color: "rgba(60,45,25,.6)" }}>
                That's the whole setup. One number — nothing else to connect.
              </p>
              <div className="mt-5 flex items-stretch border border-hairline bg-white">
                <span className="grid place-items-center px-3 text-[15px] text-ink-warm">+1</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  placeholder="555 123 4567"
                  className="flex-1 py-3 pr-4 text-[15.5px] text-ink-warm outline-none placeholder:opacity-40"
                />
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={pinNote}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-60"
                  style={{ background: "var(--ink-warm)" }}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Pin the note
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="text-[13px] font-medium"
                  style={{ color: "rgba(60,45,25,.6)" }}
                >
                  Back
                </button>
              </div>
              <p className="mt-4 text-[11.5px]" style={{ color: "rgba(60,45,25,.55)" }}>
                Only this note texts you. Nothing else, ever — and "stop" turns it off in one word.
              </p>
            </div>
            <div className="rounded-[14px] p-5" style={{ background: "var(--ink-warm)" }}>
              <p className="font-mono text-[9.5px] tracking-[0.14em]" style={{ color: "rgba(255,255,255,.55)" }}>
                WHAT ARRIVES TOMORROW, 7:02 AM
              </p>
              <div
                className="mt-3 rounded-[14px_14px_14px_4px] p-3.5 text-[13.5px] leading-snug"
                style={{ background: "#fff", color: "var(--ink-warm)" }}
              >
                {(result?.text || "Nothing worth telling you today.").split("\n")[0]}
              </div>
              <p className="mt-3 text-[11.5px]" style={{ color: "rgba(255,255,255,.6)" }}>
                One message. Not a notification, not an inbox.
              </p>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="mx-auto max-w-[560px]">
            <p className="font-mono text-[9.5px] tracking-[0.18em]" style={{ color: "rgba(60,45,25,.55)" }}>
              STEP 5 — PINNED
            </p>
            <h2 className="mt-2 font-display text-[26px] font-semibold leading-tight text-ink-warm sm:text-[30px]">
              That's one thing off your plate, for good.
            </h2>
            <p className="mt-2 text-[13.5px]" style={{ color: "rgba(60,45,25,.6)" }}>
              Everything it ever does gets written down — read it as notes on a wall, or as a book. Most people put up
              a second one within a day.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <StickyNote id={note} caption="PINNED · NOTE 1 OF 3 FREE" className="p-5">
                {note}
              </StickyNote>
              <button
                type="button"
                onClick={() => restartWith(ex?.next || "Watch for chicken thighs under $1.50 and text me")}
                className="border border-dashed p-5 text-left transition-colors hover:bg-black/[0.02]"
                style={{ borderColor: "rgba(60,45,25,.35)" }}
              >
                <p className="font-mono text-[9.5px] tracking-[0.14em]" style={{ color: "rgba(60,45,25,.55)" }}>
                  PEOPLE ALSO PIN THIS →
                </p>
                <p className="mt-2 font-hand text-[17px] leading-tight text-ink-warm">
                  {ex?.next || "Watch for chicken thighs under $1.50 and text me"}
                </p>
              </button>
            </div>
            <div className="mt-8 rounded-[18px] p-5" style={{ background: "var(--ink-warm)" }}>
              <p className="text-[13.5px]" style={{ color: "oklch(0.96 0.02 85)" }}>
                Three notes are free, forever.
              </p>
              <p className="mt-1 text-[13.5px]" style={{ color: "rgba(255,255,255,.65)" }}>
                $6 a month when you want unlimited — and everyone you look after included. Cancel in one tap.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPayOpen(true)}
                  className="rounded-full px-4 py-2 text-[12.5px] font-semibold"
                  style={{ background: "var(--amber-cta)", color: "#2b1d0e" }}
                >
                  Try Pro
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/?note=${createdId || ""}`)}
                  className="rounded-full border px-4 py-2 text-[12.5px] font-medium"
                  style={{ borderColor: "rgba(255,255,255,.25)", color: "rgba(255,255,255,.75)" }}
                >
                  Open your note
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <PaymentSheet open={payOpen} onClose={() => setPayOpen(false)} />
    </div>
  );
}
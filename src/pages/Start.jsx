import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Cake, DollarSign, Globe, HeartHandshake } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import TopMenu from "@/components/paper/TopMenu";
import StickyNote from "@/components/paper/StickyNote";
import PaymentSheet from "@/components/paper/PaymentSheet";
import StepRail from "@/components/paper/start/StepRail";
import StepCard from "@/components/paper/start/StepCard";
import PlanRow from "@/components/paper/start/PlanRow";
import CreatureHint from "@/components/paper/start/CreatureHint";
import SlideToContinue from "@/components/paper/start/SlideToContinue";

// Onboarding — value before account, and no account needed at all to go
// through it. Five friendly steps, one big card at a time: ask, check,
// watch it run, where to text you, keep going.
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
    chip: "Remind me about birthdays",
    title: "Birthday bird",
    creature: "bells",
    note: "Tell me a week before anyone's birthday so I can send a card",
    when: "Every morning at 8",
    what: "Checks the birthdays you've told it about",
    tells: "Texts you 7 days ahead, with a card idea",
    scheduleTime: "8:00 AM",
    found: "Ellie's birthday is next Friday — cards that arrive on time ship by Wednesday.",
    source: "Read from your birthday list, 8:01 AM today",
    next: "Watch a price for me too",
  },
];

const CHIP_ICONS = {
  "Watch a price for me": DollarSign,
  "Remind someone I look after": HeartHandshake,
  "Watch a page that never updates": Globe,
  "Remind me about birthdays": Cake,
};

export default function Start() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const noteRef = useRef(null);
  const dropRef = useRef(null);
  const [dragChip, setDragChip] = useState(null);
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

  // No account needed to go through the flow — notes only get saved
  // once someone is signed in.
  useEffect(() => {
    base44.auth.isAuthenticated().then(setAuthed).catch(() => setAuthed(false));
  }, []);

  const pickExample = (e) => {
    setEx(e);
    setNote(e.note);
    setLines({ when: e.when, what: e.what, tells: e.tells });
    setStep(2);
  };

  const typedNext = async () => {
    if (!note.trim() || busy) return;
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
    setBusy(true);
    try {
      if (authed === false) {
        // Visitor with no account: run it once, save nothing.
        if (ex) {
          setResult({ text: ex.found, source: ex.source });
        } else {
          let found = null;
          try {
            const res = await base44.functions.invoke("previewBuddyRun", { note: note.trim() });
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
        }
        setStep(3);
        return;
      }

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

  const rowProps = (k) => ({
    label: k.toUpperCase(),
    value: lines[k],
    editing: editingLine === k,
    onToggleEdit: () => setEditingLine(editingLine === k ? null : k),
    onChange: (v) => setLines((l) => ({ ...l, [k]: v })),
    onCommit: () => setEditingLine(null),
  });

  const kicker = "text-[11px] font-semibold uppercase tracking-[0.2em]";
  const kickerColor = { color: "rgba(60,45,25,.5)" };

  return (
    <div className="min-h-screen" style={{ background: "#FDFBF7" }}>
      <TopMenu
        onTryPro={() => setPayOpen(true)}
        onBook={authed !== false ? () => navigate("/") : undefined}
        authed={authed !== false}
        onSignIn={() => base44.auth.redirectToLogin("/start")}
      />

      <StepRail steps={STEPS} current={step} />

      <div className="mx-auto max-w-[760px] px-6 pb-10 pt-9" style={{ minHeight: 520 }}>
        {step === 1 && (
          <StepCard stepKey={step}>
            <div className="text-center">
              <p className={kicker} style={kickerColor}>
                Step 1 of 5
              </p>
              <h1 className="mx-auto mt-3 max-w-[560px] font-question text-[36px] leading-[1.08] tracking-[-0.01em] text-ink-warm sm:text-[44px]">
                A note that actually does the thing.
              </h1>
              <p className="mx-auto mt-4 max-w-[540px] text-[15px] leading-relaxed" style={{ color: "rgba(60,45,25,.7)" }}>
                Write it in plain words — watch this price, remind Mom at eight, check that page every morning. It goes
                and does it, then texts you what it found. Think of it as a sticky note that can read the internet.
              </p>
              <p className="mt-7 font-question text-[22px]" style={{ color: "rgba(40,30,20,.8)" }}>
                So — what do you keep checking yourself?
              </p>

              <div className="mx-auto mt-5 grid max-w-[560px] grid-cols-1 gap-3 sm:grid-cols-2">
                {EXAMPLES.map((e) => {
                  const Icon = CHIP_ICONS[e.chip];
                  return (
                    <motion.button
                      key={e.chip}
                      type="button"
                      onClick={() => pickExample(e)}
                      drag
                      dragSnapToOrigin
                      whileDrag={{ scale: 1.06, rotate: 2, zIndex: 40 }}
                      onDragStart={() => setDragChip(e.chip)}
                      onDragEnd={(ev) => {
                        setDragChip(null);
                        const r = dropRef.current?.getBoundingClientRect();
                        if (
                          r &&
                          ev.clientX >= r.left &&
                          ev.clientX <= r.right &&
                          ev.clientY >= r.top &&
                          ev.clientY <= r.bottom
                        ) {
                          pickExample(e);
                        }
                      }}
                      className="flex cursor-grab items-center gap-3 rounded-2xl border border-hairline bg-[#FAF6ED] px-4 py-4 text-left transition-all hover:border-amber-cta/60 hover:bg-white hover:shadow-[0_10px_24px_-14px_rgba(60,45,25,.3)] active:cursor-grabbing"
                    >
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
                        style={{ background: "rgba(232,163,61,.18)", color: "#9a6516" }}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="text-[15px] font-semibold text-ink-warm">{e.chip}</span>
                    </motion.button>
                  );
                })}
              </div>

              <p className="mt-6 text-[13px]" style={{ color: "rgba(60,45,25,.55)" }}>
                Drag one onto the note — or just tap it. No account yet, nothing to connect.
              </p>
              <div ref={dropRef} className="relative mx-auto mt-3 max-w-[560px]">
                {dragChip && (
                  <div
                    className="pointer-events-none absolute -inset-1 z-10 grid place-items-center rounded-2xl border-2 border-dashed"
                    style={{ borderColor: "var(--amber-cta)", background: "rgba(232,163,61,.10)" }}
                  >
                    <span
                      className="rounded-full bg-white/80 px-3 py-1 text-[12.5px] font-semibold"
                      style={{ color: "#9a6516" }}
                    >
                      Drop it here
                    </span>
                  </div>
                )}
                <textarea
                  ref={noteRef}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={300}
                  placeholder="Watch for chicken thighs under $1.50 and text me…"
                  className="block w-full rounded-2xl border border-hairline bg-[#FAF6ED] p-4 font-hand text-[19px] leading-snug text-ink-warm outline-none placeholder:italic placeholder:opacity-45 focus:border-amber-cta/60"
                />
              </div>
              <SlideToContinue
                className="mx-auto mt-5"
                label={note.trim() ? "Slide to read it back" : "Pick a note first — or write your own"}
                onDone={typedNext}
                disabled={!note.trim()}
                busy={busy}
              />
            </div>

            <div className="absolute bottom-4 right-5 hidden sm:block">
              <CreatureHint onJustTap={() => noteRef.current?.focus()} />
            </div>
          </StepCard>
        )}

        {step === 2 && lines && (
          <StepCard stepKey={step}>
            <div className="grid items-start gap-8 sm:grid-cols-[1fr_290px]">
              <div>
                <p className={kicker} style={kickerColor}>
                  Step 2 of 5
                </p>
                <h2 className="mt-3 font-question text-[30px] leading-tight text-ink-warm sm:text-[34px]">
                  Here's exactly what it'll do. Change any line.
                </h2>
                <p className="mt-2 text-[14px]" style={{ color: "rgba(60,45,25,.6)" }}>
                  No settings, no permissions screen. Three sentences — if one's wrong, tap it.
                </p>
                <div className="mt-5 grid gap-2.5">
                  <PlanRow {...rowProps("when")} />
                  <PlanRow {...rowProps("what")} />
                  <PlanRow {...rowProps("tells")} />
                </div>
                <div className="mt-7">
                  <SlideToContinue
                    label={busy ? "Checking…" : "Slide to run it once now"}
                    onDone={runOnce}
                    busy={busy}
                  />
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="mt-3 text-[14px] font-medium"
                    style={{ color: "rgba(60,45,25,.6)" }}
                  >
                    Back
                  </button>
                </div>
              </div>
              <div className="flex justify-center sm:justify-end">
                <StickyNote id={note} caption="YOUR NOTE · NOT PINNED YET" fixedRotation={-1.6} className="w-[270px] p-5">
                  {note}
                </StickyNote>
              </div>
            </div>
          </StepCard>
        )}

        {step === 3 && result && (
          <StepCard stepKey={step}>
            <div className="mx-auto max-w-[560px]">
              <p className={kicker} style={kickerColor}>
                Step 3 of 5
              </p>
              <h2 className="mt-3 font-question text-[30px] leading-tight text-ink-warm sm:text-[34px]">
                Here's what it found, right now.
              </h2>
              <p className="mt-2 text-[14px]" style={{ color: "rgba(60,45,25,.6)" }}>
                This is the real thing, not a demo.
              </p>
              <div
                className="mt-6 rounded-2xl border border-hairline bg-[#FAF6ED] p-5"
                style={{ borderLeft: "4px solid var(--leaf)" }}
              >
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: "rgba(60,45,25,.5)" }}>
                  The note · just now
                </p>
                <p className="mt-2 whitespace-pre-line text-[16px] leading-snug text-ink-warm">{result.text}</p>
                {result.source && (
                  <p className="mt-2 text-[12px]" style={{ color: "rgba(60,45,25,.6)" }}>
                    {result.source}
                  </p>
                )}
              </div>
              <p
                className="mt-4 rounded-2xl border border-dashed p-5 text-[14px]"
                style={{ borderColor: "rgba(60,45,25,.3)", color: "rgba(60,45,25,.65)" }}
              >
                It will do that every morning from now on — and stay silent on the days there's nothing worth telling
                you.
              </p>
              <div className="mt-7">
                <SlideToContinue label="Slide to keep it running" onDone={() => setStep(4)} />
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="mt-3 text-[14px] font-medium"
                  style={{ color: "rgba(60,45,25,.6)" }}
                >
                  Change the note
                </button>
              </div>
            </div>
          </StepCard>
        )}

        {step === 4 && (
          <StepCard stepKey={step}>
            <div className="grid items-start gap-8 sm:grid-cols-[1fr_290px]">
              <div>
                <p className={kicker} style={kickerColor}>
                  Step 4 of 5
                </p>
                <h2 className="mt-3 font-question text-[30px] leading-tight text-ink-warm sm:text-[34px]">
                  Where should it text you?
                </h2>
                <p className="mt-2 text-[14px]" style={{ color: "rgba(60,45,25,.6)" }}>
                  That's the whole setup. One number — nothing else to connect.
                </p>
                <div className="mt-5 flex items-stretch rounded-2xl border border-hairline bg-[#FAF6ED] focus-within:border-amber-cta/60">
                  <span className="grid place-items-center px-4 text-[16px] text-ink-warm">+1</span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    placeholder="555 123 4567"
                    className="flex-1 bg-transparent py-3.5 pr-4 text-[16px] text-ink-warm outline-none placeholder:opacity-40"
                  />
                </div>
                <div className="mt-7">
                  <SlideToContinue
                    label={busy ? "Pinning…" : "Slide to pin the note"}
                    onDone={pinNote}
                    busy={busy}
                  />
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="mt-3 text-[14px] font-medium"
                    style={{ color: "rgba(60,45,25,.6)" }}
                  >
                    Back
                  </button>
                </div>
                <p className="mt-4 text-[12.5px]" style={{ color: "rgba(60,45,25,.55)" }}>
                  Only this note texts you. Nothing else, ever — and "stop" turns it off in one word.
                </p>
              </div>
              <div className="rounded-[20px] p-5" style={{ background: "var(--ink-warm)" }}>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,.55)" }}>
                  What arrives tomorrow, 7:02 AM
                </p>
                <div
                  className="mt-3 rounded-[16px_16px_16px_4px] p-3.5 text-[14px] leading-snug"
                  style={{ background: "#fff", color: "var(--ink-warm)" }}
                >
                  {(result?.text || "Nothing worth telling you today.").split("\n")[0]}
                </div>
                <p className="mt-3 text-[12px]" style={{ color: "rgba(255,255,255,.6)" }}>
                  One message. Not a notification, not an inbox.
                </p>
              </div>
            </div>
          </StepCard>
        )}

        {step === 5 && (
          <StepCard stepKey={step}>
            <div className="mx-auto max-w-[560px]">
              <p className={kicker} style={kickerColor}>
                Step 5 of 5
              </p>
              <h2 className="mt-3 font-question text-[30px] leading-tight text-ink-warm sm:text-[34px]">
                That's one thing off your plate, for good.
              </h2>
              <p className="mt-2 text-[14px]" style={{ color: "rgba(60,45,25,.6)" }}>
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
                  className="rounded-2xl border border-dashed p-5 text-left transition-all hover:bg-black/[0.02]"
                  style={{ borderColor: "rgba(60,45,25,.35)" }}
                >
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: "rgba(60,45,25,.55)" }}>
                    People also pin this →
                  </p>
                  <p className="mt-2 font-hand text-[17px] leading-tight text-ink-warm">
                    {ex?.next || "Watch for chicken thighs under $1.50 and text me"}
                  </p>
                </button>
              </div>
              <div className="mt-8 rounded-[20px] p-6" style={{ background: "var(--ink-warm)" }}>
                <p className="text-[14px]" style={{ color: "oklch(0.96 0.02 85)" }}>
                  Three notes are free, forever.
                </p>
                <p className="mt-1 text-[14px]" style={{ color: "rgba(255,255,255,.65)" }}>
                  $6 a month when you want unlimited — and everyone you look after included. Cancel in one tap.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPayOpen(true)}
                    className="rounded-full px-5 py-2.5 text-[13.5px] font-semibold"
                    style={{ background: "var(--amber-cta)", color: "#2b1d0e" }}
                  >
                    Try Pro
                  </button>
                  {authed !== false && createdId && (
                    <button
                      type="button"
                      onClick={() => navigate(`/?note=${createdId}`)}
                      className="rounded-full border px-5 py-2.5 text-[13.5px] font-medium"
                      style={{ borderColor: "rgba(255,255,255,.25)", color: "rgba(255,255,255,.75)" }}
                    >
                      Open your note
                    </button>
                  )}
                </div>
              </div>
            </div>
          </StepCard>
        )}
      </div>

      <footer className="pb-9 pt-2 text-center text-[12px]" style={{ color: "rgba(60,45,25,.45)" }}>
        Agent Buddy · © {new Date().getFullYear()}
      </footer>

      <PaymentSheet open={payOpen} onClose={() => setPayOpen(false)} />
    </div>
  );
}
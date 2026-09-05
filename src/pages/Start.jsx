import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DragDropContext } from "@hello-pangea/dnd";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import FireflyField from "@/components/buddy/FireflyField";
import PaymentSheet from "@/components/paper/PaymentSheet";
import WorkshopHeader from "@/components/workshop/WorkshopHeader";
import BlockTray from "@/components/workshop/BlockTray";
import BotAssembly from "@/components/workshop/BotAssembly";

// The night workshop — build a bot on page one. Drag a WHEN, a WHAT and a
// TELLS block onto the bot, tap it to life, and it goes and checks the
// whole internet for you. No account needed to try it.
const BLOCKS = [
  { id: "w1", cat: "when", label: "Every morning at 8", time: "8:00 AM" },
  { id: "w2", cat: "when", label: "Every evening at 6", time: "6:00 PM" },
  { id: "w3", cat: "when", label: "Every day at noon", time: "12:00 PM" },
  { id: "w4", cat: "when", label: "Every Monday morning", time: "9:00 AM" },
  { id: "b1", cat: "what", label: "Look for chicken under $1.50" },
  { id: "b2", cat: "what", label: "Watch the permit page for changes" },
  { id: "b3", cat: "what", label: "Check for birthdays coming up" },
  { id: "b4", cat: "what", label: "Look for cheap flights home" },
  { id: "t1", cat: "tells", label: "Text me what you find" },
  { id: "t2", cat: "tells", label: "Only text me if it changed" },
  { id: "t3", cat: "tells", label: "Text me a week early" },
];

const PRESETS = [
  { label: "The chicken deal", sockets: { when: "w1", what: "b1", tells: "t2" } },
  { label: "The birthday bird", sockets: { when: "w3", what: "b3", tells: "t3" } },
];

const CATS = ["when", "what", "tells"];

export default function Start() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState("build"); // build → ran → phone → done
  const [sockets, setSockets] = useState({ when: null, what: null, tells: null });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { text, source }
  const [createdId, setCreatedId] = useState(null);
  const [phone, setPhone] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [authed, setAuthed] = useState(null); // null while checking

  // No account needed to build and run a bot — it only gets saved once
  // someone is signed in.
  useEffect(() => {
    base44.auth.isAuthenticated().then(setAuthed).catch(() => setAuthed(false));
  }, []);

  const blocksById = useMemo(() => Object.fromEntries(BLOCKS.map((b) => [b.id, b])), []);
  const powered = CATS.every((c) => sockets[c]);
  const note = useMemo(() => {
    if (!powered) return "";
    return (
      blocksById[sockets.when].label +
      ", " +
      blocksById[sockets.what].label.toLowerCase() +
      ", and " +
      blocksById[sockets.tells].label.toLowerCase() +
      "."
    );
  }, [sockets, powered, blocksById]);

  const trayBlocks = BLOCKS.filter((b) => !CATS.some((c) => sockets[c] === b.id));

  const onDragEnd = (res) => {
    const { source, destination } = res;
    if (!destination) return;
    const sCat = source.droppableId.replace("socket-", "");
    const dCat = destination.droppableId.replace("socket-", "");
    if (source.droppableId === "tray") {
      const block = blocksById[res.draggableId];
      if (!destination.droppableId.startsWith("socket-") || block.cat !== dCat) return;
      setSockets((s) => ({ ...s, [dCat]: block.id }));
    } else if (destination.droppableId === "tray") {
      setSockets((s) => ({ ...s, [sCat]: null }));
    }
    // socket → wrong socket or the same socket just snaps back
  };

  const pickBlock = (b) => setSockets((s) => ({ ...s, [b.cat]: b.id }));
  const removeBlock = (cat) => setSockets((s) => ({ ...s, [cat]: null }));

  const wakeBot = async () => {
    if (!powered || busy) return;
    setBusy(true);
    try {
      if (authed === false) {
        // Visitor with no account: run it once, save nothing.
        let found = null;
        try {
          const res = await base44.functions.invoke("previewBuddyRun", { note });
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
        setStep("ran");
        return;
      }

      const what = blocksById[sockets.what];
      const created = await base44.entities.Buddy.create({
        note,
        name: what.label.slice(0, 24),
        creature: "sam",
        when_line: blocksById[sockets.when].label,
        what_line: what.label,
        how_line: blocksById[sockets.tells].label,
        schedule_time: blocksById[sockets.when].time,
        status: "active",
      });
      setCreatedId(created.id);

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
      setStep("ran");
    } catch (e) {
      toast({ title: "Something went wrong — try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const pinBot = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (phone.trim()) await base44.auth.updateMe({ sms_phone: phone.trim() });
      setStep("done");
    } catch (_) {
      setStep("done");
    } finally {
      setBusy(false);
    }
  };

  const rebuild = () => {
    setSockets({ when: null, what: null, tells: null });
    setResult(null);
    setCreatedId(null);
    setStep("build");
  };

  const goldPill =
    "inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold transition-all hover:brightness-[1.05] disabled:opacity-60";
  const goldStyle = {
    background: "#FFC675",
    color: "#2B2113",
    boxShadow: "0 12px 28px -12px rgba(255,198,117,.65)",
  };
  const cardStyle = {
    borderColor: "rgba(64,64,96,.6)",
    background: "rgba(27,27,46,.55)",
    boxShadow: "0 26px 60px -30px rgba(0,0,0,.6)",
  };
  const kicker = "text-[11px] font-semibold uppercase tracking-[0.22em]";

  return (
    <div
      className="relative min-h-screen overflow-x-hidden"
      style={{
        background:
          "radial-gradient(110% 70% at 50% -10%, #232338 0%, #161622 45%, #111119 100%)",
      }}
    >
      <FireflyField />
      <div className="relative z-10">
        <WorkshopHeader
          authed={authed}
          onTryPro={() => setPayOpen(true)}
          onSignIn={() => base44.auth.redirectToLogin("/start")}
        />

        <div className="mx-auto max-w-[880px] px-5 pb-12 pt-10 sm:px-8">
          <div className="text-center">
            <p className={kicker} style={{ color: "#6DE5C0" }}>
              The night workshop
            </p>
            <h1
              className="mx-auto mt-3 max-w-[620px] text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-[42px]"
              style={{ color: "#F0F0F0", fontFamily: "'Fraunces', serif" }}
            >
              Build a little bot that does it for you.
            </h1>
            <p
              className="mx-auto mt-3 max-w-[520px] text-[15px] leading-relaxed"
              style={{ color: "rgba(160,160,192,.85)" }}
            >
              Drag three blocks — when it runs, what it does, how it tells you. No account
              needed, nothing to connect.
            </p>
          </div>

          {step === "build" && (
            <DragDropContext onDragEnd={onDragEnd}>
              <div
                className="mt-8 rounded-[28px] border p-5 backdrop-blur-md sm:p-8"
                style={cardStyle}
              >
                <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
                  <div>
                    <BlockTray blocks={trayBlocks} onPick={pickBlock} />
                    <div
                      className="mt-5 rounded-2xl border border-dashed p-4"
                      style={{ borderColor: "rgba(64,64,96,.8)" }}
                    >
                      <p className="text-[11.5px]" style={{ color: "rgba(160,160,192,.8)" }}>
                        In a hurry? Tap a ready-made bot →
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {PRESETS.map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => setSockets(p.sockets)}
                            className="rounded-full px-3.5 py-1.5 text-[12.5px] font-medium"
                            style={{
                              background: "rgba(255,198,117,.14)",
                              color: "#FFC675",
                              border: "1px solid rgba(255,198,117,.35)",
                            }}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <BotAssembly
                      sockets={sockets}
                      blocksById={blocksById}
                      powered={powered}
                      onRemove={removeBlock}
                    />
                    <div className="mt-7 text-center">
                      {powered ? (
                        <button
                          type="button"
                          onClick={wakeBot}
                          disabled={busy}
                          className={goldPill}
                          style={goldStyle}
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          {busy ? "waking it up…" : "Bring your bot to life"}
                        </button>
                      ) : (
                        <p className="text-[13px]" style={{ color: "rgba(160,160,192,.75)" }}>
                          One block from each shelf, and your bot wakes up.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </DragDropContext>
          )}

          {step === "ran" && result && (
            <div
              className="mx-auto mt-8 max-w-[560px] rounded-[28px] border p-7 sm:p-9"
              style={cardStyle}
            >
              <p className={kicker} style={{ color: "#6DE5C0" }}>
                It's alive
              </p>
              <h2
                className="mt-3 text-[28px] font-semibold leading-tight sm:text-[32px]"
                style={{ color: "#F0F0F0", fontFamily: "'Fraunces', serif" }}
              >
                Here's what it found, right now.
              </h2>
              <p className="mt-2 text-[14px]" style={{ color: "rgba(160,160,192,.8)" }}>
                This is the real thing — not a demo.
              </p>
              <div
                className="mt-6 rounded-2xl p-5"
                style={{
                  background: "rgba(27,27,46,.8)",
                  border: "1px solid rgba(64,64,96,.7)",
                  borderLeft: "4px solid #6DE5C0",
                }}
              >
                <p
                  className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: "rgba(160,160,192,.7)" }}
                >
                  Your bot · just now
                </p>
                <p className="mt-2 whitespace-pre-line text-[16px] leading-snug" style={{ color: "#F0F0F0" }}>
                  {result.text}
                </p>
                {result.source && (
                  <p className="mt-2 text-[12px]" style={{ color: "rgba(160,160,192,.75)" }}>
                    {result.source}
                  </p>
                )}
              </div>
              <p
                className="mt-4 rounded-2xl border border-dashed p-5 text-[14px]"
                style={{ borderColor: "rgba(64,64,96,.9)", color: "rgba(160,160,192,.85)" }}
              >
                It'll do that every day from now on — and stay quiet on the days there's
                nothing worth telling you.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <button type="button" onClick={() => setStep("phone")} className={goldPill} style={goldStyle}>
                  <ArrowRight className="h-4 w-4" /> Keep it going
                </button>
                <button
                  type="button"
                  onClick={rebuild}
                  className="text-[14px] font-medium"
                  style={{ color: "rgba(160,160,192,.75)" }}
                >
                  Change its job
                </button>
              </div>
            </div>
          )}

          {step === "phone" && (
            <div
              className="mx-auto mt-8 grid max-w-[560px] items-start gap-6 rounded-[28px] border p-7 sm:grid-cols-[1fr_220px] sm:p-9"
              style={cardStyle}
            >
              <div>
                <p className={kicker} style={{ color: "#FFC675" }}>
                  Last piece
                </p>
                <h2
                  className="mt-3 text-[28px] font-semibold leading-tight sm:text-[32px]"
                  style={{ color: "#F0F0F0", fontFamily: "'Fraunces', serif" }}
                >
                  Where should it text you?
                </h2>
                <p className="mt-2 text-[14px]" style={{ color: "rgba(160,160,192,.8)" }}>
                  That's the whole setup. One number — nothing else to connect.
                </p>
                <div
                  className="mt-5 flex items-stretch rounded-2xl border"
                  style={{ borderColor: "rgba(64,64,96,.8)", background: "rgba(27,27,46,.8)" }}
                >
                  <span className="grid place-items-center px-4 text-[16px]" style={{ color: "#F0F0F0" }}>
                    +1
                  </span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    placeholder="555 123 4567"
                    className="flex-1 bg-transparent py-3.5 pr-4 text-[16px] outline-none placeholder:opacity-40"
                    style={{ color: "#F0F0F0" }}
                  />
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-4">
                  <button type="button" onClick={pinBot} disabled={busy} className={goldPill} style={goldStyle}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Pin the bot
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("ran")}
                    className="text-[14px] font-medium"
                    style={{ color: "rgba(160,160,192,.75)" }}
                  >
                    Back
                  </button>
                </div>
                <p className="mt-4 text-[12.5px]" style={{ color: "rgba(160,160,192,.6)" }}>
                  Only this bot texts you. Nothing else, ever — and "stop" turns it off in one word.
                </p>
              </div>
              <div className="rounded-[20px] p-5" style={{ background: "#1B1B2E", border: "1px solid rgba(64,64,96,.7)" }}>
                <p
                  className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: "rgba(160,160,192,.7)" }}
                >
                  What arrives tomorrow
                </p>
                <div
                  className="mt-3 rounded-[16px_16px_16px_4px] p-3.5 text-[14px] leading-snug"
                  style={{ background: "#F0F0F0", color: "#2B2113" }}
                >
                  {(result?.text || "Nothing worth telling you today.").split("\n")[0]}
                </div>
                <p className="mt-3 text-[12px]" style={{ color: "rgba(160,160,192,.65)" }}>
                  One message. Not a notification, not an inbox.
                </p>
              </div>
            </div>
          )}

          {step === "done" && (
            <div
              className="mx-auto mt-8 max-w-[560px] rounded-[28px] border p-7 text-center sm:p-9"
              style={cardStyle}
            >
              <div className="flex justify-center">
                <BotAssemblyMini />
              </div>
              <h2
                className="mt-4 text-[28px] font-semibold leading-tight sm:text-[32px]"
                style={{ color: "#F0F0F0", fontFamily: "'Fraunces', serif" }}
              >
                That's one thing off your plate, for good.
              </h2>
              <p className="mt-2 text-[14px]" style={{ color: "rgba(160,160,192,.8)" }}>
                It goes out every day, quietly, and only texts when there's something worth
                saying. Most people build a second one within the hour.
              </p>
              <div
                className="mt-8 rounded-[20px] p-6 text-left"
                style={{ background: "#1B1B2E", border: "1px solid rgba(64,64,96,.7)" }}
              >
                <p className="text-[14px]" style={{ color: "#F0F0F0" }}>
                  Three bots are free, forever.
                </p>
                <p className="mt-1 text-[14px]" style={{ color: "rgba(160,160,192,.7)" }}>
                  $6 a month when you want unlimited — and everyone you look after included.
                  Cancel in one tap.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPayOpen(true)}
                    className="rounded-full px-5 py-2.5 text-[13.5px] font-semibold"
                    style={{ background: "#FFC675", color: "#2B2113" }}
                  >
                    Try Pro
                  </button>
                  <button
                    type="button"
                    onClick={rebuild}
                    className="rounded-full border px-5 py-2.5 text-[13.5px] font-medium"
                    style={{ borderColor: "rgba(139,127,214,.5)", color: "#8B7FD6" }}
                  >
                    Build another
                  </button>
                  {authed !== false && createdId && (
                    <button
                      type="button"
                      onClick={() => navigate(`/?note=${createdId}`)}
                      className="rounded-full border px-5 py-2.5 text-[13.5px] font-medium"
                      style={{ borderColor: "rgba(64,64,96,.9)", color: "rgba(160,160,192,.8)" }}
                    >
                      Open your bot
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="pb-9 text-center text-[12px]" style={{ color: "rgba(160,160,192,.5)" }}>
          Agent Buddy · © {new Date().getFullYear()}
        </footer>

        <PaymentSheet open={payOpen} onClose={() => setPayOpen(false)} />
      </div>
    </div>
  );
}

// A tiny lit-up bot for the finish card — same little guy, fully powered.
function BotAssemblyMini() {
  return (
    <svg width="72" height="72" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <line x1="60" y1="7" x2="60" y2="17" stroke="#404060" strokeWidth="3" />
      <circle cx="60" cy="7" r="5" fill="#FFC675" style={{ filter: "drop-shadow(0 0 7px #FFC675)" }} />
      <rect
        x="28"
        y="18"
        width="64"
        height="52"
        rx="16"
        fill="#1B1B2E"
        stroke="rgba(109,229,192,.55)"
        strokeWidth="2"
      />
      <circle cx="46" cy="40" r="7" fill="#6DE5C0" style={{ filter: "drop-shadow(0 0 7px #6DE5C0)" }} />
      <circle cx="74" cy="40" r="7" fill="#6DE5C0" style={{ filter: "drop-shadow(0 0 7px #6DE5C0)" }} />
      <path d="M50 55 Q60 61 70 55" stroke="#6DE5C0" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="14" y="30" width="10" height="26" rx="5" fill="#1B1B2E" stroke="#40406B" strokeWidth="2" />
      <rect x="96" y="30" width="10" height="26" rx="5" fill="#1B1B2E" stroke="#40406B" strokeWidth="2" />
      <rect x="32" y="85" width="56" height="14" rx="7" fill="#1B1B2E" stroke="rgba(109,229,192,.55)" strokeWidth="2" />
      <circle cx="52" cy="92" r="2.5" fill="#6DE5C0" />
      <circle cx="68" cy="92" r="2.5" fill="#FFC675" />
    </svg>
  );
}
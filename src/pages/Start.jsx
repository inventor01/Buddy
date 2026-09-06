import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUp, Check, ImagePlus, Loader2, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { useToast } from "@/components/ui/use-toast";
import PlanBoard from "@/components/maker/PlanBoard";
import FoundIt from "@/components/maker/FoundIt";
import { savePendingNote } from "@/lib/pendingNote";
import { ensureTimezone } from "@/lib/timezone";

// One box, like a chat window — but what you type becomes a small set of
// cards you can drag and reword before it runs. Simple enough for anyone,
// quiet enough for a big company. No jargon on the screen, ever.

function flightDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const EXAMPLES = [
  { label: "Find it", text: `Find me the best nonstop roundtrip flight from Detroit to Miami departing ${flightDate(28)} and returning ${flightDate(31)} under $300` },
  { label: "Keep watch", text: "Tell me when a PS6 preorder opens at a major retailer" },
  { label: "Compare it", text: "Find three well-rated plumbers in Detroit and compare their prices, ratings, and availability" },
  { label: "Remember it", text: "My mom likes gardening, coffee, and mystery books. Suggest three birthday gifts for her under $75 and remember those preferences" },
  { label: "Plan it", text: "Plan a simple birthday party for 12 people under $400 and make me a checklist" },
  { label: "Handle weekly", text: "Every Monday morning, give me the five biggest AI and technology stories from the past week with one sentence on why each matters" },
];

const CATS = ["when", "what", "tells"];
const BUDDY_REQUEST_MAX = 8000;

function isSimplePlanningRequest(text) {
  const lower = String(text || "").toLowerCase();
  return /\b(plan|checklist|outline|ideas?)\b/.test(lower) && !/\b(email|gmail|calendar|tasks?|to-?do)\b/.test(lower);
}

function deterministicMissingDetail(text) {
  const value = String(text || "").trim();
  const lower = value.toLowerCase();
  const looksLikeFlight = /\b(flight|flights|airfare|plane ticket|airline)\b/.test(lower);
  const hasDestination = /\b(to|into)\s+[a-z]/i.test(value);
  const hasOrigin = /\b(from|leaving|depart(?:ing)?(?: from)?)\s+[a-z]/i.test(value);
  if (looksLikeFlight && hasDestination && !hasOrigin) {
    return "What city or airport are you flying from?";
  }
  const localService = /\b(near me|nearby|close to me)\b/.test(lower) && /\b(plumber|electrician|roofer|mechanic|restaurant|dentist|doctor|contractor|cleaner|salon|barber)\b/.test(lower);
  if (localService) return "What city or ZIP code should Buddy search around?";
  return "";
}

export default function Start() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState("compose"); // compose → plan → ran → phone → done
  const [note, setNote] = useState("");
  const [image, setImage] = useState(null); // uploaded photo that rides along
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const [lines, setLines] = useState(null); // { when, what, tells, name, creature, scheduleTime, question }
  const [answer, setAnswer] = useState("");
  const [order, setOrder] = useState(CATS);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { text, source }
  const [createdId, setCreatedId] = useState(null);
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [phoneMasked, setPhoneMasked] = useState("");
  const [phoneError, setPhoneError] = useState("");
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
      if (!plan) {
        const serverErr = res.data?.error;
        throw new Error(serverErr || "It couldn't read that — try again.");
      }
      const modelQuestion = typeof plan.question === "string" ? plan.question : "";
      const requiredDetail = isSimplePlanningRequest(note) && /\b(date|when|whose|who'?s)\b/i.test(modelQuestion)
        ? ""
        : deterministicMissingDetail(note) || modelQuestion;
      setLines({
        when: plan.when_line,
        what: plan.what_line,
        tells: plan.how_line,
        name: plan.name,
        creature: plan.creature,
        kind: ["ads", "social"].includes(plan.kind) ? plan.kind : "web",
        runMode: ["once", "watch", "repeat"].includes(plan.run_mode) ? plan.run_mode : "once",
        capability: ["gmail", "calendar", "tasks"].includes(plan.capability) ? plan.capability : "web",
        actionType: plan.action_type || "none",
        actionPayload: plan.action_payload || {},
        approvalRequired: plan.approval_required === true,
        deferredAction: plan.deferred_action === true,
        linkedBuddyIds: Array.isArray(plan.linked_buddy_ids) ? plan.linked_buddy_ids : [],
        linkedBuddyNames: Array.isArray(plan.linked_buddy_names) ? plan.linked_buddy_names : [],
        executionMode: plan.execution_mode === "chain" ? "chain" : "single",
        taskSteps: Array.isArray(plan.task_steps) ? plan.task_steps : [],
        scheduleTime: plan.schedule_time,
        question: requiredDetail,
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
    const requiredDetail = lines?.question || deterministicMissingDetail(note);
    if (requiredDetail && !answer.trim()) {
      setLines((current) => current ? { ...current, question: requiredDetail } : current);
      toast({ title: requiredDetail });
      return;
    }
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
            ...(answer.trim() ? { context: [answer.trim()] } : {}),
          });
          const state = res.data?.state || "answer";
          const ls = res.data?.lines || [];
          if (state === "needs_detail") {
            const missing = res.data?.message || ls[0] || "One more detail is needed.";
            setLines((current) => current ? { ...current, question: missing } : current);
            setAnswer("");
            setResult({ state: "needs_detail", text: missing, items: [] });
            setStep("ran");
            return;
          }
          if (state === "empty") {
            setResult({ state: "empty", text: res.data?.message || "Buddy couldn't verify a useful answer yet.", items: [] });
            setStep("ran");
            return;
          }
          if (ls.length) {
            found = ls;
            foundItems = res.data?.items || null;
          }
        } catch (_) {
          /* the fallback below covers it */
        }
        setResult(
          found
            ? { state: "answer", text: found.join("\n"), source: "Sources checked just now", items: foundItems }
            : { state: "error", message: "Buddy couldn't finish that request right now. Nothing was changed.", text: "Try again or make the request a little more specific." }
        );
        setStep("ran");
        return;
      }

      // The note is about to be scheduled, so the account needs to know which
      // clock "every morning at 9" is being kept on.
      const me = await base44.auth.me();
      await ensureTimezone(base44, me);

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

      const createRes = await base44.functions.invoke("createBuddyRecord", {
        note: note.trim(),
        image_url: image,
        kind: ["ads", "social"].includes(lines.kind) ? lines.kind : "web",
        run_mode: ["once", "watch", "repeat"].includes(lines.runMode) ? lines.runMode : "once",
        capability: ["gmail", "calendar", "tasks"].includes(lines.capability) ? lines.capability : "web",
        action_type: lines.actionType || "none",
        action_payload: lines.actionPayload || {},
        approval_status: lines.approvalRequired ? "pending" : "not_needed",
        deferred_action: lines.deferredAction === true,
        linked_buddy_ids: Array.isArray(lines.linkedBuddyIds) ? lines.linkedBuddyIds : [],
        execution_mode: lines.executionMode === "chain" ? "chain" : "single",
        task_steps: Array.isArray(lines.taskSteps) ? lines.taskSteps : [],
        ...(answer.trim() ? { context: [answer.trim()] } : {}),
        name: lines.name || "Your helper",
        creature: lines.creature || "sam",
        when_line: lines.when,
        what_line: lines.what,
        how_line: lines.tells,
        schedule_time: scheduleTime,
      });
      const created = createRes.data?.buddy;
      if (!created) throw new Error(createRes.data?.error || "Could not create that thing.");
      setCreatedId(created.id);

      if (lines.approvalRequired) {
        setResult({
          state: "approval",
          text: "Buddy has the next step ready. Review exactly what will happen before anything is sent or changed.",
          source: null,
        });
        setStep("ran");
        return;
      }

      let found = null;
      let foundItems = null;
      let runError = "";
      try {
        const res = await base44.functions.invoke("runBuddyNow", { buddyId: created.id });
        if (res.data?.needs_connection) {
          setResult({ state: "needs_connection", text: res.data?.lines?.[0] || "Connect the account this request needs before Buddy can continue." });
          setStep("ran");
          return;
        }
        if (res.data?.state === "approval") {
          const ls = res.data?.lines || [];
          setResult({
            state: "approval",
            text: res.data?.message || ls.join("\n") || "The next step is ready for your approval.",
            items: res.data?.items || [],
          });
          setStep("ran");
          return;
        }
        if (res.data?.state === "needs_detail") {
          const missing = res.data?.message || res.data?.lines?.[0] || "One more detail is needed.";
          setLines((current) => current ? { ...current, question: missing } : current);
          setAnswer("");
          setResult({ state: "needs_detail", text: missing, items: [] });
          setStep("ran");
          return;
        }
        const ls = res.data?.lines || [];
        if (ls.length) {
          found = ls;
          foundItems = res.data?.items || null;
        }
      } catch (e) {
        runError = e?.response?.data?.error || e?.message || "";
      }
      setResult(
        found
          ? { state: "answer", text: found.join("\n"), source: "Sources checked just now", items: foundItems }
          : {
              state: "error",
              message: "Buddy couldn't finish that request right now. Nothing was changed.",
              text: runError || "Try again or make the request a little more specific."
            }
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
    setPhoneError("");
    const raw = phone.trim();
    const normalised = raw ? (raw.startsWith('+') ? raw : '+1' + raw.replace(/\D/g, '')) : '';

    if (authed === false) {
      // The request still needs an account before it can be saved. Carry the
      // number across sign-in, but do not mark it usable for texts until the
      // confirmation code is completed after sign-in.
      savePendingNote({
        note: note.trim(),
        image,
        lines: { ...lines, answer: answer.trim() },
        phone: normalised,
      });
      base44.auth.redirectToLogin("/notes");
      return;
    }

    if (!normalised) {
      setStep("done");
      return;
    }

    setBusy(true);
    try {
      if (!phoneCodeSent) {
        const res = await base44.functions.invoke("phoneVerification", { action: "start", phone: normalised });
        setPhoneMasked(res.data?.phone_masked || "");
        setPhoneCodeSent(true);
        setPhoneCode("");
        return;
      }
      if (phoneCode.replace(/\D/g, "").length !== 6) {
        setPhoneError("Enter the 6-digit code we texted you.");
        return;
      }
      await base44.functions.invoke("phoneVerification", { action: "verify", code: phoneCode });
      setStep("done");
    } catch (e) {
      setPhoneError(e?.response?.data?.error || e?.message || "That number couldn't be confirmed.");
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setNote("");
    setImage(null);
    setLines(null);
    setAnswer("");
    setOrder(CATS);
    setEditing(null);
    setResult(null);
    setCreatedId(null);
    setPhone("");
    setPhoneCode("");
    setPhoneCodeSent(false);
    setPhoneMasked("");
    setPhoneError("");
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
                onClick={() => navigate("/notes")}
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
                Hand off what’s on your mind.
              </h1>
              <p className="mx-auto mt-3.5 max-w-[500px] text-[15.5px] leading-relaxed text-neutral-500">
                Write what you need in plain English. Buddy can handle it now, keep an eye on it,
                or keep doing it for you — then bring the result back when there’s something worth your attention.
              </p>
              <p className="mx-auto mt-2 max-w-[500px] text-[13px] leading-relaxed text-neutral-400">
                No setup language. No dashboards to learn. Just say what you want handled.
              </p>
            </div>

            <div className="glass mt-8 rounded-[22px] p-2.5">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={BUDDY_REQUEST_MAX}
                placeholder="What do you want handled?"
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
                  <span className="hidden text-[11.5px] text-neutral-400 sm:inline">No account needed</span>
                  <span className="text-[10.5px] tabular-nums text-neutral-400" aria-label={`${note.length} of ${BUDDY_REQUEST_MAX} characters used`}>
                    {note.length.toLocaleString()}/{BUDDY_REQUEST_MAX.toLocaleString()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toPlan}
                  disabled={!note.trim() || busy}
                  className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-[13.5px] font-medium text-white disabled:opacity-40"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                  {busy ? "Working it out…" : "Hand it off"}
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
              <p className={kicker}>Here’s how it’ll handle it</p>
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

            {lines.question && (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-amber-700">
                  One more thing
                </p>
                <p className="mt-1.5 text-[15px] leading-snug text-neutral-800">{lines.question}</p>
                <input
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Your answer — it remembers this for every run"
                  className="mt-3 w-full rounded-xl border border-amber-300 bg-white px-3.5 py-2.5 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-amber-400"
                />
              </div>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <button type="button" onClick={runOnce} disabled={busy} className={primary}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {busy ? "Handling it…" : "Try it now"}
              </button>
              <button type="button" onClick={() => setStep("compose")} className={ghost}>
                Change the words
              </button>
            </div>
          </div>
        )}

        {step === "ran" && result && (
          <FoundIt
            result={result}
            runMode={lines?.runMode || "once"}
            onContinue={() => {
              if (result.state === "needs_detail") {
                setStep("plan");
                return;
              }
              if (result.state === "needs_connection" && authed !== false) {
                navigate("/settings");
                return;
              }
              if (result.state === "approval" && authed !== false && createdId) {
                navigate(`/notes?note=${createdId}`);
                return;
              }
              if (result.state === "error") {
                runOnce();
                return;
              }
              setStep("phone");
            }}
            onRestart={restart}
          />
        )}

        {step === "phone" && (
          <div className={card}>
            <p className={kicker}>Last piece</p>
            <h2 className={`mt-3 ${h2}`}>Where should Buddy reach you?</h2>
            <p className="mt-2 text-[14px] text-neutral-500">
              {authed === false
                ? "Add a number if you want important updates outside the app. A quick account keeps your requests saved."
                : "Add a number if you want important updates outside the app. You can leave this blank and keep everything here."}
            </p>
            {!phoneCodeSent && (
              <div className="mt-5 flex items-stretch rounded-xl border border-neutral-300 bg-white focus-within:border-neutral-500">
                <span className="grid place-items-center px-4 text-[16px] text-neutral-400">+1</span>
                <input
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setPhoneError(""); }}
                  inputMode="tel"
                  placeholder="555 123 4567"
                  className="flex-1 bg-transparent py-3.5 pr-4 text-[16px] text-neutral-900 outline-none placeholder:text-neutral-400"
                />
              </div>
            )}
            {phoneCodeSent && (
              <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
                <p className="text-[13px] text-neutral-700">Enter the 6-digit code sent to {phoneMasked || "your phone"}.</p>
                <input
                  value={phoneCode}
                  onChange={(e) => { setPhoneCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setPhoneError(""); }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  className="mt-3 w-36 rounded-xl border border-white bg-white px-3 py-2.5 text-center font-mono text-[17px] tracking-[0.18em] outline-none"
                />
              </div>
            )}
            {phoneError && <p className="mt-3 text-[12.5px] text-red-600">{phoneError}</p>}
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <button type="button" onClick={pinPhone} disabled={busy} className={primary}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {authed === false ? "Save this and make my account" : phoneCodeSent ? "Confirm number" : phone.trim() ? "Send confirmation code" : "Keep it in the app"}
              </button>
              <button type="button" onClick={() => setStep("ran")} className={ghost}>
                Back
              </button>
            </div>
            <p className="mt-4 text-[12.5px] text-neutral-400">
              Buddy only texts confirmed numbers. You can skip this and keep every update inside the app.
            </p>
          </div>
        )}

        {step === "done" && (
          <div className={`${card} text-center`}>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50">
              <Check className="h-5 w-5 text-emerald-600" />
            </span>
            <h2 className={`mt-4 ${h2}`}>That’s off your plate.</h2>
            <p className="mx-auto mt-2 max-w-[440px] text-[14px] leading-relaxed text-neutral-500">
              Buddy will handle it the way you asked — once, by keeping watch, or on a repeat schedule.
              You can open it anytime to change the request or ask a follow-up.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button type="button" onClick={restart} className={outline}>
                Start another
              </button>
              {authed !== false && createdId && (
                <button
                  type="button"
                  onClick={() => navigate(`/notes?note=${createdId}`)}
                  className={ghost}
                >
                  Open it
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="pb-9 text-center text-[12px] text-neutral-400">
        Buddy · © {new Date().getFullYear()}
      </footer>

    </div>
  );
}
import React, { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Clock3,
  ExternalLink,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import ProductCard from "./ProductCard";

const buzz = (pattern) => {
  try { navigator.vibrate?.(pattern); } catch (_) {}
};

const rise = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: "easeOut" } },
};

function cleanItems(result, state) {
  if (Array.isArray(result?.items) && result.items.length) {
    return result.items
      .map((it) => ({
        ...it,
        text: String(it?.text || "").trim(),
        source: String(it?.source || "").trim(),
        url: String(it?.url || "").trim(),
      }))
      .filter((it) => it.text);
  }
  if (state !== "answer") return [];
  return String(result?.text || "")
    .split("\n")
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => ({ text, source: "", url: "" }));
}

function ResultRow({ item, index }) {
  if (item.product) return <ProductCard item={item} />;
  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-neutral-100 text-[11px] font-semibold text-neutral-500">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-relaxed text-neutral-900">{item.text}</p>
          {item.why_fit && (
            <p className="mt-1.5 text-[12px] font-medium text-emerald-700">Why this fits you: {item.why_fit}</p>
          )}
          {(item.source || item.url) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {item.source && <span className="text-[11.5px] font-medium text-neutral-400">{item.source}</span>}
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11.5px] font-medium text-neutral-500 hover:text-neutral-900"
                >
                  Check source <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FoundIt({ result, runMode = "once", onContinue, onRestart }) {
  const state = result?.state || "answer";
  const items = useMemo(() => cleanItems(result, state), [result, state]);
  const isError = state === "error";
  const needsDetail = state === "needs_detail";
  const needsConnection = state === "needs_connection";
  const approval = state === "approval";
  const empty = state === "empty" || (!items.length && !result?.text);

  const meta = useMemo(() => {
    if (isError) return {
      icon: TriangleAlert,
      eyebrow: "Couldn’t finish this one",
      title: "Buddy hit a snag.",
      body: result?.message || "Nothing was changed. Try again or change the request.",
      tone: "amber",
    };
    if (needsDetail) return {
      icon: Search,
      eyebrow: "One detail needed",
      title: "Buddy knows what to do next.",
      body: result?.message || result?.text || "Add the missing detail and Buddy can finish this.",
      tone: "amber",
    };
    if (needsConnection) return {
      icon: ShieldCheck,
      eyebrow: "One connection needed",
      title: "Buddy is ready when you are.",
      body: result?.message || result?.text || "Connect the account this request needs, then Buddy can continue.",
      tone: "blue",
    };
    if (approval) return {
      icon: ShieldCheck,
      eyebrow: "Ready for your review",
      title: "Nothing happens until you approve it.",
      body: result?.message || result?.text || "Buddy prepared the next step for you to review.",
      tone: "blue",
    };
    if (empty) return {
      icon: Search,
      eyebrow: runMode === "watch" ? "Still watching" : "No solid answer yet",
      title: runMode === "watch" ? "Nothing worth bothering you about yet." : "Buddy couldn’t verify a useful answer yet.",
      body: runMode === "watch" ? "It’ll stay quiet until something actually changes." : "Try making the request a little more specific.",
      tone: "neutral",
    };
    return {
      icon: runMode === "watch" ? Clock3 : Check,
      eyebrow: runMode === "watch" ? "Found something worth showing you" : "Handled",
      title: result?.headline || (items.length === 1 ? "Here’s the answer." : `Here are the ${items.length} best things Buddy found.`),
      body: runMode === "watch"
        ? "Buddy can keep an eye on this and only bring you back when something meaningful changes."
        : "The useful part is up top. Sources are there when you want to double-check anything.",
      tone: "emerald",
    };
  }, [approval, empty, isError, items.length, needsConnection, needsDetail, result, runMode]);

  useEffect(() => { buzz(isError ? [20, 30, 20] : 18); }, [isError]);

  const Icon = meta.icon;
  const toneClasses = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    blue: "bg-sky-50 text-sky-700 ring-sky-100",
    neutral: "bg-neutral-100 text-neutral-600 ring-neutral-200",
  };

  const primaryLabel = isError
    ? "Try again"
    : needsDetail
      ? "Add the detail"
      : needsConnection
        ? "Connect and continue"
        : approval
          ? "Review it"
          : runMode === "watch"
            ? "Keep watching"
            : runMode === "repeat"
              ? "Save this routine"
              : "Save this";

  return (
    <motion.div initial="hidden" animate="show" className="mx-auto max-w-[760px]">
      <motion.div variants={rise} className="overflow-hidden rounded-[28px] border border-white/80 bg-white/75 shadow-[0_24px_70px_-42px_rgba(24,24,27,.35)] backdrop-blur-2xl">
        <div className="px-6 pb-6 pt-7 sm:px-8 sm:pb-8 sm:pt-9">
          <div className="flex items-start gap-4">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ring-1 ${toneClasses[meta.tone]}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-neutral-400">{meta.eyebrow}</p>
              <h2 className="mt-2 font-heading text-[28px] font-semibold leading-[1.08] tracking-tight text-neutral-950 sm:text-[34px]">
                {meta.title}
              </h2>
              <p className="mt-2 max-w-[620px] text-[14px] leading-relaxed text-neutral-500">{meta.body}</p>
            </div>
          </div>

          {items.length > 0 && !needsDetail && !needsConnection && !approval && (
            <div className="mt-7 space-y-2.5">
              {items.map((item, index) => (
                <motion.div key={`${item.text}-${index}`} variants={rise}>
                  <ResultRow item={item} index={index} />
                </motion.div>
              ))}
            </div>
          )}

          {(needsDetail || needsConnection || approval || isError) && result?.text && result.text !== meta.body && (
            <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 text-[14px] leading-relaxed text-neutral-700">
              {result.text}
            </div>
          )}

          {result?.source && items.length > 0 && (
            <div className="mt-4 flex items-center gap-2 text-[11.5px] text-neutral-400">
              <Sparkles className="h-3.5 w-3.5" />
              {result.source}
            </div>
          )}
        </div>

        <div className="border-t border-neutral-200/70 bg-neutral-50/65 px-6 py-5 sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[12.5px] leading-relaxed text-neutral-500">
              {approval
                ? "You stay in control. Buddy won’t send or change anything until you approve it."
                : runMode === "watch"
                  ? "No spam. Buddy stays quiet when nothing meaningful changes."
                  : runMode === "repeat"
                    ? "You can change or stop this anytime."
                    : "Save it if you want this kept with the rest of your things."}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => { buzz(10); onRestart(); }}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium text-neutral-500 hover:bg-white hover:text-neutral-900"
              >
                <RefreshCcw className="h-3.5 w-3.5" /> Change request
              </button>
              <button
                type="button"
                onClick={() => { buzz(14); onContinue(); }}
                className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-4.5 py-2.5 text-[13.5px] font-semibold text-white shadow-sm transition hover:bg-neutral-800"
              >
                {primaryLabel} <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

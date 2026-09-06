import React from "react";
import { ArrowRight, CheckCircle2, Clock3, Eye, Hand, Sparkles } from "lucide-react";
import Composer from "./Composer";

function firstLine(buddy) {
  if (Array.isArray(buddy?.last_result) && buddy.last_result[0]) return String(buddy.last_result[0]);
  const messages = Array.isArray(buddy?.messages) ? buddy.messages : [];
  const last = [...messages].reverse().find((m) => m?.who === "note" && m?.text);
  return last?.text ? String(last.text).split("\n")[0] : "";
}

function ThingRow({ buddy, icon: Icon, label, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(buddy.id)}
      className="group flex w-full items-start gap-3 rounded-2xl border border-white/70 bg-white/60 px-4 py-3.5 text-left transition hover:bg-white/90"
    >
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-500">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[14px] font-semibold text-neutral-900">{buddy.name}</span>
          <span className="shrink-0 text-[10.5px] font-medium uppercase tracking-[0.12em] text-neutral-400">{label}</span>
        </span>
        <span className="mt-1 block line-clamp-2 text-[12.5px] leading-relaxed text-neutral-500">
          {firstLine(buddy) || buddy.what_line || buddy.note}
        </span>
      </span>
      <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-neutral-600" />
    </button>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h3 className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-neutral-400">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export default function CommandCenter({ me, profile, buddies, receipts = [], escalations = [], onOpen, onPin, busy }) {
  const name = String(profile?.display_name || me?.name || me?.email?.split("@")[0] || "there").trim();
  const needsYou = buddies.filter((b) => b.approval_status === "pending" || b.approval_status === "needs_connection" || b.open_question);
  const unresolved = escalations.filter((e) => e.status === "open").slice(0, 4);
  const handled = buddies.filter((b) => b.status === "done").slice(0, 3);
  const watching = buddies.filter((b) => b.status === "active" && b.run_mode === "watch").slice(0, 3);
  const repeating = buddies.filter((b) => b.status === "active" && b.run_mode === "repeat").slice(0, 3);
  const activeCount = buddies.filter((b) => b.status === "active").length;
  const handledCount = buddies.filter((b) => b.status === "done").length;
  const timeSaved = receipts.reduce((sum, r) => sum + (Number(r?.estimated_time_saved_minutes) || 0), 0);
  const recentInsight = [...buddies]
    .filter((b) => firstLine(b))
    .sort((a, b) => String(b.updated_date || b.created_date).localeCompare(String(a.updated_date || a.created_date)))[0];

  return (
    <div className="mx-auto max-w-[760px] space-y-8">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">Your day with Buddy</p>
        <h1 className="mt-2 font-heading text-[32px] font-semibold tracking-tight text-neutral-950 sm:text-[38px]">
          Good to see you, {name}.
        </h1>
        <p className="mt-2 text-[14px] text-neutral-500">
          {needsYou.length || unresolved.length
            ? `${needsYou.length + unresolved.length} ${needsYou.length + unresolved.length === 1 ? "thing needs" : "things need"} you. Buddy is handling ${activeCount} more.`
            : activeCount
              ? `Nothing needs you right now. Buddy is handling ${activeCount} ${activeCount === 1 ? "thing" : "things"}.`
              : handledCount
                ? `${handledCount} ${handledCount === 1 ? "thing is" : "things are"} already off your plate.`
                : "Hand something off and Buddy will keep the important part here."}
        </p>
        {receipts.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-100 bg-emerald-50/70 px-3 py-1.5 text-[11.5px] font-medium text-emerald-700">{receipts.length} handled with receipts</span>
            {timeSaved > 0 && <span className="rounded-full border border-white/70 bg-white/60 px-3 py-1.5 text-[11.5px] font-medium text-neutral-600">About {timeSaved >= 60 ? `${Math.floor(timeSaved / 60)}h ${timeSaved % 60}m` : `${timeSaved}m`} back</span>}
          </div>
        )}
      </div>

      {unresolved.length > 0 && (
        <div className="rounded-[24px] border border-rose-100 bg-rose-50/50 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-rose-800">
            <Hand className="h-4 w-4" />
            <h2 className="text-[13px] font-semibold">Needs another way</h2>
          </div>
          <div className="space-y-2">
            {unresolved.map((e) => {
              const buddy = buddies.find((b) => b.id === e.buddy_id);
              if (!buddy) return null;
              return (
                <button key={e.id} type="button" onClick={() => onOpen(buddy.id)} className="w-full rounded-2xl border border-white/70 bg-white/65 px-4 py-3 text-left hover:bg-white">
                  <p className="text-[13.5px] font-semibold text-neutral-900">{e.title || buddy.name}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-neutral-600">{e.reason}</p>
                  {e.next_step && <p className="mt-1.5 text-[11.5px] font-medium text-rose-700">Next: {e.next_step}</p>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {needsYou.length > 0 && (
        <div className="rounded-[24px] border border-amber-100 bg-amber-50/55 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-amber-800">
            <Hand className="h-4 w-4" />
            <h2 className="text-[13px] font-semibold">Needs you</h2>
          </div>
          <div className="space-y-2">
            {needsYou.slice(0, 4).map((b) => (
              <ThingRow key={b.id} buddy={b} icon={Hand} label={b.open_question ? "one detail" : "review"} onOpen={onOpen} />
            ))}
          </div>
        </div>
      )}

      {recentInsight && !needsYou.some((b) => b.id === recentInsight.id) && (
        <button type="button" onClick={() => onOpen(recentInsight.id)} className="glass w-full rounded-[24px] p-5 text-left transition hover:bg-white/80 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Sparkles className="h-4 w-4" /></span>
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Buddy noticed</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-neutral-800">{firstLine(recentInsight)}</p>
              <p className="mt-2 text-[11.5px] font-medium text-neutral-400">From {recentInsight.name}</p>
            </div>
          </div>
        </button>
      )}

      <Composer onPin={onPin} busy={busy} buddies={buddies} />

      {(watching.length > 0 || repeating.length > 0 || handled.length > 0) && (
        <div className="grid gap-6 sm:grid-cols-2">
          {watching.length > 0 && (
            <Section title="Keeping watch">
              {watching.map((b) => <ThingRow key={b.id} buddy={b} icon={Eye} label="watching" onOpen={onOpen} />)}
            </Section>
          )}
          {repeating.length > 0 && (
            <Section title="Coming up">
              {repeating.map((b) => <ThingRow key={b.id} buddy={b} icon={Clock3} label={b.when_line || "recurring"} onOpen={onOpen} />)}
            </Section>
          )}
          {handled.length > 0 && (
            <Section title="Recently handled">
              {handled.map((b) => <ThingRow key={b.id} buddy={b} icon={CheckCircle2} label="done" onOpen={onOpen} />)}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

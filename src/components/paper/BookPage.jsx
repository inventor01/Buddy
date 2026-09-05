import React, { useMemo } from "react";
import moment from "moment";

// Your book — the same history as a ruled page. Entries sit on the lines,
// newest last, grouped by week.
export default function BookPage({ buddies }) {
  const groups = useMemo(() => {
    const entries = [];
    for (const b of buddies || []) {
      const msgs = Array.isArray(b.messages) ? b.messages : [];
      if (msgs.length) {
        for (const m of msgs) entries.push({ at: m.at, title: b.name, text: m.text });
      } else if (Array.isArray(b.last_result) && b.last_result.length) {
        entries.push({ at: b.last_run_date || b.updated_date, title: b.name, text: b.last_result.join(" ") });
      }
    }
    entries.sort((a, b) => new Date(a.at) - new Date(b.at));
    const byWeek = new Map();
    for (const e of entries) {
      const start = moment(e.at).startOf("isoWeek");
      const key = start.format("YYYY-MM-DD");
      if (!byWeek.has(key)) {
        byWeek.set(key, { label: `${start.format("MMM D")} – ${start.add(6, "days").format("MMM D")}`, items: [] });
      }
      byWeek.get(key).items.push(e);
    }
    return Array.from(byWeek.values());
  }, [buddies]);

  return (
    <div className="relative min-h-[200px] overflow-y-auto">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 top-0"
        style={{ left: 18, borderLeft: "2px solid rgba(200,60,40,.45)" }}
      />
      <div
        className="min-h-full px-4 py-2"
        style={{
          background: "var(--paper-card)",
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent 0 27px, rgba(60,80,120,.22) 27px 28px)",
        }}
      >
        {groups.length === 0 && (
          <p className="py-3 text-[12px]" style={{ color: "rgba(60,45,25,.5)" }}>
            When your notes do things, it all gets written down here.
          </p>
        )}
        {groups.map((g) => (
          <div key={g.label} className="mb-4">
            <p className="font-mono text-[9.5px] tracking-[0.14em]" style={{ color: "rgba(60,45,25,.5)" }}>
              {g.label.toUpperCase()}
            </p>
            {g.items.map((e, i) => (
              <p key={i} className="font-hand text-[15px] leading-[28px] text-ink-warm">
                {e.title}: <span style={{ color: "rgba(40,30,20,.8)" }}>{e.text}</span>
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
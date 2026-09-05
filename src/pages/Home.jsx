import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Menu } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import TopMenu from "@/components/paper/TopMenu";
import Rail from "@/components/paper/Rail";
import Composer from "@/components/paper/Composer";
import ThreadView from "@/components/paper/ThreadView";
import PaymentSheet from "@/components/paper/PaymentSheet";
import { readBigText, applyBigText } from "@/lib/bigText";

// The home page IS the product (10a) — a rail of note threads on the left,
// the composer or the open thread on the right.
export default function Home() {
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [buddies, setBuddies] = useState(null);
  const [me, setMe] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [view, setView] = useState("notes");
  const [railOpen, setRailOpen] = useState(false);
  const [bigText, setBigText] = useState(readBigText());
  const [pinning, setPinning] = useState(false);
  const [sending, setSending] = useState(false);

  const selectedId = params.get("note");
  const pro = me?.plan === "pro";
  const selected = (buddies || []).find((b) => b.id === selectedId) || null;

  const load = useCallback(async () => {
    try {
      const user = await base44.auth.me();
      setMe(user);
      const list = await base44.entities.Buddy.filter({ created_by_id: user.id }, "-updated_date", 50);
      setBuddies(list);
    } catch (e) {
      setBuddies([]);
    }
  }, []);

  useEffect(() => {
    applyBigText(readBigText());
    load();
  }, [load]);

  const selectNote = (id) => {
    setParams({ note: id });
    setView("notes");
    setRailOpen(false);
  };

  const newNote = () => {
    setParams({});
    setView("notes");
    setRailOpen(false);
  };

  const toggleBigText = () => {
    const next = !bigText;
    setBigText(next);
    applyBigText(next);
  };

  const handlePin = async (note) => {
    if (!pro && (buddies?.length || 0) >= 3) {
      setPayOpen(true);
      toast({ title: "Three notes are free. Pro is $6 a month for unlimited." });
      throw new Error("plan limit");
    }
    setPinning(true);
    try {
      const res = await base44.functions.invoke("createBuddyFromNote", { note });
      const plan = res.data?.plan;
      if (!plan) throw new Error("That note didn't read back right — try again.");
      const created = await base44.entities.Buddy.create({ note, ...plan, status: "active" });
      setBuddies((prev) => [created, ...(prev ?? [])]);
      setParams({ note: created.id });
    } catch (e) {
      toast({ title: e.message || "That note didn't hatch — try again.", variant: "destructive" });
      throw e;
    } finally {
      setPinning(false);
    }
  };

  const togglePause = async (b) => {
    const status = b.status === "paused" ? "active" : "paused";
    await base44.entities.Buddy.update(b.id, { status });
    setBuddies((prev) => prev.map((x) => (x.id === b.id ? { ...x, status } : x)));
  };

  const takeDown = async (b) => {
    await base44.entities.Buddy.delete(b.id);
    setBuddies((prev) => prev.filter((x) => x.id !== b.id));
    if (b.id === selectedId) setParams({});
  };

  const editNote = async (b, text) => {
    await base44.entities.Buddy.update(b.id, { note: text });
    setBuddies((prev) => prev.map((x) => (x.id === b.id ? { ...x, note: text } : x)));
  };

  const sendInThread = async (b, text) => {
    setSending(true);
    try {
      const youMsg = { who: "you", at: new Date().toISOString(), text };
      let msgs = [...(b.messages || []), youMsg];
      setBuddies((p) => p.map((x) => (x.id === b.id ? { ...x, messages: msgs } : x)));
      await base44.entities.Buddy.update(b.id, { messages: msgs });
      try {
        const res = await base44.functions.invoke("runBuddyNow", { buddyId: b.id });
        const lines = res.data?.lines || [];
        if (lines.length) {
          const foundItems = res.data?.items || [];
          const noteMsg = {
            who: "note",
            at: new Date().toISOString(),
            text: lines.join("\n"),
            items: foundItems,
          };
          msgs = [...msgs, noteMsg];
          setBuddies((p) => p.map((x) => (x.id === b.id ? { ...x, messages: msgs, last_result: lines } : x)));
          await base44.entities.Buddy.update(b.id, { messages: msgs, last_result: lines });
        }
      } catch (e) {
        toast({ title: "That run didn't finish — try again.", variant: "destructive" });
      }
    } finally {
      setSending(false);
    }
  };

  const railProps = {
    buddies: buddies || [],
    selectedId,
    onSelect: selectNote,
    onNewNote: newNote,
    view,
    onViewChange: setView,
    onSignOut: () => base44.auth.logout("/login"),
    onToggleBigText: toggleBigText,
    bigText,
  };

  return (
    <div className="page-glow min-h-screen">
      <TopMenu onTryPro={() => setPayOpen(true)} onBook={() => { setView("book"); setParams({}); }} />

      <div className="mx-auto max-w-6xl lg:grid lg:grid-cols-[250px_1fr]">
        {/* rail — desktop sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-[53px] max-h-[calc(100vh-53px)] overflow-y-auto">
            <Rail {...railProps} />
          </div>
        </aside>

        {/* main column */}
        <main className="min-h-[520px] px-6 py-9 sm:px-10">
          <button
            type="button"
            onClick={() => setRailOpen(true)}
            className="glass mb-5 inline-flex items-center gap-2 rounded-full px-3 py-2 text-[12.5px] font-medium text-neutral-700 lg:hidden"
          >
            <Menu className="h-4 w-4" /> Your notes
          </button>

          {buddies === null ? (
            <p className="flex items-center gap-2 text-[13px] text-neutral-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Opening your notes…
            </p>
          ) : selected ? (
            <ThreadView
              buddy={selected}
              onPause={togglePause}
              onTakeDown={takeDown}
              onEditNote={editNote}
              onSend={sendInThread}
              busy={sending}
            />
          ) : (
            <Composer onPin={handlePin} busy={pinning} />
          )}
        </main>
      </div>

      {/* rail — mobile drawer */}
      {railOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0" style={{ background: "rgba(24,24,27,.32)" }} onClick={() => setRailOpen(false)} />
          <div
            className="glass absolute left-0 top-0 h-full w-[280px] overflow-y-auto rounded-r-2xl"
          >
            <Rail {...railProps} />
          </div>
        </div>
      )}

      <PaymentSheet open={payOpen} onClose={() => setPayOpen(false)} />
    </div>
  );
}
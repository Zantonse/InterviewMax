"use client";

import { useEffect, useState } from "react";
import { SectionHead } from "./section-head";

const KEY = "imx:bank-view";
type View = "cards" | "counts";

// The story bank's two looks (Nov 12, "By count"): a cue card per story, or the themes counted
// (how many stories answer each, gaps at the bottom). The pick is remembered on this device.
export function BankViews({
  headingId,
  note,
  extra,
  cards,
  counts,
}: {
  headingId: string;
  note: React.ReactNode;
  extra?: React.ReactNode;
  cards: React.ReactNode;
  counts: React.ReactNode;
}) {
  const [view, setView] = useState<View>("cards");
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restored once on mount; storage isn't readable during render without a hydration mismatch
      if (localStorage.getItem(KEY) === "counts") setView("counts");
    } catch {
      // Storage can be blocked; cards it is.
    }
  }, []);
  function pick(next: View) {
    setView(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Not remembered, still switched.
    }
  }
  const tab = (id: View, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={view === id}
      onClick={() => pick(id)}
      className={`rounded-md px-2.5 py-0.5 text-sm font-medium transition-colors ${
        view === id ? "bg-white text-slate-900 ring-1 ring-ink-200" : "text-slate-600 hover:text-slate-900"
      }`}
      data-testid={`bank-view-${id}`}
    >
      {label}
    </button>
  );
  return (
    <div>
      <SectionHead
        id={headingId}
        title="Story bank"
        note={note}
        action={
          <>
            <div role="tablist" aria-label="Story bank view" className="flex rounded-lg bg-ink-50 p-0.5">
              {tab("cards", "Cards")}
              {tab("counts", "By theme")}
            </div>
            {extra}
          </>
        }
      />
      <div className={view === "cards" ? "" : "hidden"}>{cards}</div>
      <div className={view === "counts" ? "" : "hidden"}>{counts}</div>
    </div>
  );
}

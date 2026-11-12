"use client";

import { useEffect, useState } from "react";

const KEY = "imx:bank-view";
type View = "tiles" | "counts";

// The story bank card's two looks: one tile per theme with its best story, or the same themes as
// a counted list (how many stories answer each, gaps at the bottom). The pick is remembered on
// this device.
export function BankViews({ tiles, counts }: { tiles: React.ReactNode; counts: React.ReactNode }) {
  const [view, setView] = useState<View>("tiles");
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restored once on mount; storage isn't readable during render without a hydration mismatch
      if (localStorage.getItem(KEY) === "counts") setView("counts");
    } catch {
      // Storage can be blocked; tiles it is.
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
      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
        view === id ? "bg-white text-ink-900" : "text-ink-100 hover:bg-white/10"
      }`}
      data-testid={`bank-view-${id}`}
    >
      {label}
    </button>
  );
  return (
    <div>
      <div role="tablist" aria-label="Story bank view" className="mt-3 inline-flex gap-1 rounded-full bg-white/10 p-0.5">
        {tab("tiles", "Tiles")}
        {tab("counts", "By count")}
      </div>
      <div className={view === "tiles" ? "" : "hidden"}>{tiles}</div>
      <div className={view === "counts" ? "" : "hidden"}>{counts}</div>
    </div>
  );
}

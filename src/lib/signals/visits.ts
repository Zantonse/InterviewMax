import { FRICTION_KINDS, type SignalKind } from "./kinds";

export type StoredSignal = { kind: SignalKind; path: string; target: string; at: string };

export type Visit = {
  start: string;
  end: string;
  // Distinct pages opened.
  pages: number;
  friction: number;
  // Oldest first, as the visit happened.
  signals: StoredSignal[];
};

// A gap longer than this starts a new visit.
export const VISIT_GAP_MS = 30 * 60 * 1000;

// Groups signals (any order) into visits, newest visit first, for the admin timeline.
export function groupVisits(signals: StoredSignal[]): Visit[] {
  const sorted = [...signals].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const groups: StoredSignal[][] = [];
  for (const signal of sorted) {
    const last = groups.at(-1);
    const prev = last?.at(-1);
    if (last && prev && Date.parse(signal.at) - Date.parse(prev.at) <= VISIT_GAP_MS) last.push(signal);
    else groups.push([signal]);
  }
  return groups
    .map((group) => ({
      start: group[0].at,
      end: group[group.length - 1].at,
      pages: new Set(group.filter((s) => s.kind === "page_view").map((s) => s.path)).size,
      friction: group.filter((s) => FRICTION_KINDS.has(s.kind)).length,
      signals: group,
    }))
    .reverse();
}

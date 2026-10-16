import { FRICTION_KINDS, type SignalKind } from "@/lib/signals/kinds";
import { USAGE_EVENTS, type UsageEvent } from "@/lib/usage/events";
import { funnel, median, timeToValue, type EventFirst, type FunnelStep, type TimeToValue, type UserProgress } from "./metrics";

// The admin panel's analytics: usage events and click signals over a date range, worked out from
// rows of (user, event or signal kind, time). Pure, so it's tested without a database. Nothing
// here sees story text, answers or uploads; signal paths have ids replaced already.

export type EventRow = { userId: string; event: UsageEvent; at: string; estimated: boolean };
export type SignalRow = { userId: string; kind: SignalKind; path: string; at: string };

export const RANGES = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "all", label: "All time", days: null },
] as const;

export type RangeKey = (typeof RANGES)[number]["key"];
export const DEFAULT_RANGE: RangeKey = "30d";

export function parseRange(value: unknown): RangeKey {
  return RANGES.some((r) => r.key === value) ? (value as RangeKey) : DEFAULT_RANGE;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// "2026-10-16". Days are UTC, like the rest of the admin panel.
export function dayKey(at: string | number | Date): string {
  return new Date(at).toISOString().slice(0, 10);
}

// The first moment the range covers, or null for all time. A 7-day range is today and the six
// days before it.
export function rangeStart(range: RangeKey, now: Date): Date | null {
  const days = RANGES.find((r) => r.key === range)?.days ?? null;
  if (days === null) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(today - (days - 1) * DAY_MS);
}

// Every day from `start` to `end`, inclusive, as day keys.
export function daysBetween(start: Date, end: Date): string[] {
  const first = Date.parse(dayKey(start));
  const last = Date.parse(dayKey(end));
  const out: string[] = [];
  for (let t = first; t <= last; t += DAY_MS) out.push(dayKey(t));
  return out;
}

function inRange(at: string, start: Date | null): boolean {
  const t = Date.parse(at);
  return !Number.isNaN(t) && (start === null || t >= start.getTime());
}

export type DayPoint = {
  day: string;
  activeUsers: number;
  signUps: number;
  storiesStarted: number;
  storiesFinished: number;
  troubleSignals: number;
};

// Per-day counts. A user is active on a day if they recorded any event or click signal on it.
export function dailySeries(
  days: string[],
  users: UserProgress[],
  events: EventRow[],
  signals: SignalRow[],
): DayPoint[] {
  const points = new Map<string, DayPoint>(
    days.map((day) => [
      day,
      { day, activeUsers: 0, signUps: 0, storiesStarted: 0, storiesFinished: 0, troubleSignals: 0 },
    ]),
  );
  const active = new Map<string, Set<string>>();
  const markActive = (day: string, userId: string) => {
    if (!points.has(day)) return;
    if (!active.has(day)) active.set(day, new Set());
    active.get(day)!.add(userId);
  };
  // Sign-ups come from profiles, so people with no recorded sign_up event still count.
  for (const u of users) {
    const p = points.get(dayKey(u.signedUpAt));
    if (p) p.signUps += 1;
  }
  for (const e of events) {
    const day = dayKey(e.at);
    markActive(day, e.userId);
    const p = points.get(day);
    if (!p) continue;
    if (e.event === "story_started") p.storiesStarted += 1;
    if (e.event === "story_finished") p.storiesFinished += 1;
  }
  for (const s of signals) {
    const day = dayKey(s.at);
    markActive(day, s.userId);
    const p = points.get(day);
    if (p && FRICTION_KINDS.has(s.kind)) p.troubleSignals += 1;
  }
  for (const [day, ids] of active) points.get(day)!.activeUsers = ids.size;
  return days.map((day) => points.get(day)!);
}

export type Headline = {
  activeUsers: number;
  returningUsers: number;
  signUps: number;
  storiesStarted: number;
  storiesFinished: number;
  // Users active on more than one day in the range, over everyone active in it. Null if nobody was.
  returningShare: number | null;
};

export function headline(
  users: UserProgress[],
  events: EventRow[],
  signals: SignalRow[],
  start: Date | null,
): Headline {
  const daysByUser = new Map<string, Set<string>>();
  const note = (userId: string, at: string) => {
    if (!inRange(at, start)) return;
    if (!daysByUser.has(userId)) daysByUser.set(userId, new Set());
    daysByUser.get(userId)!.add(dayKey(at));
  };
  for (const e of events) note(e.userId, e.at);
  for (const s of signals) note(s.userId, s.at);
  const activeUsers = daysByUser.size;
  const returningUsers = [...daysByUser.values()].filter((d) => d.size > 1).length;
  const count = (event: UsageEvent) =>
    events.filter((e) => e.event === event && inRange(e.at, start)).length;
  return {
    activeUsers,
    returningUsers,
    signUps: users.filter((u) => inRange(u.signedUpAt, start)).length,
    storiesStarted: count("story_started"),
    storiesFinished: count("story_finished"),
    returningShare: activeUsers === 0 ? null : returningUsers / activeUsers,
  };
}

export type FeatureUse = { event: UsageEvent; times: number; users: number };

// How often each event happened in the range and by how many people, most-used first. Sign-up is
// left out (it's in the daily chart) and so are events nobody did.
export function featureUsage(events: EventRow[], start: Date | null): FeatureUse[] {
  const times = new Map<UsageEvent, number>();
  const users = new Map<UsageEvent, Set<string>>();
  for (const e of events) {
    if (e.event === "sign_up" || !inRange(e.at, start)) continue;
    times.set(e.event, (times.get(e.event) ?? 0) + 1);
    if (!users.has(e.event)) users.set(e.event, new Set());
    users.get(e.event)!.add(e.userId);
  }
  return USAGE_EVENTS.flatMap((event) =>
    times.has(event) ? [{ event, times: times.get(event)!, users: users.get(event)!.size }] : [],
  ).sort((a, b) => b.users - a.users || b.times - a.times);
}

export type Cohort = {
  users: number;
  funnel: FunnelStep[];
  toQuestions: TimeToValue;
  toStory: TimeToValue;
};

// What happened to the people who signed up in the range, however long after they got there.
export function cohort(users: UserProgress[], firsts: EventFirst[], start: Date | null): Cohort {
  const joined = users.filter((u) => inRange(u.signedUpAt, start));
  return {
    users: joined.length,
    funnel: funnel(joined, firsts),
    toQuestions: timeToValue(joined, firsts, "likely_questions_shown"),
    toStory: timeToValue(joined, firsts, "story_finished"),
  };
}

export type PageTrouble = {
  path: string;
  views: number;
  trouble: number;
  users: number;
  // The most common kind of trouble on the page.
  topKind: SignalKind | null;
};

// Pages ranked by signs of trouble (rage and dead clicks, errors, abandoned forms) in the range.
export function troublePages(signals: SignalRow[], start: Date | null, limit = 10): PageTrouble[] {
  type Acc = { views: number; trouble: number; users: Set<string>; kinds: Map<SignalKind, number> };
  const pages = new Map<string, Acc>();
  for (const s of signals) {
    if (!inRange(s.at, start)) continue;
    if (!pages.has(s.path)) pages.set(s.path, { views: 0, trouble: 0, users: new Set(), kinds: new Map() });
    const acc = pages.get(s.path)!;
    if (s.kind === "page_view") acc.views += 1;
    if (FRICTION_KINDS.has(s.kind)) {
      acc.trouble += 1;
      acc.users.add(s.userId);
      acc.kinds.set(s.kind, (acc.kinds.get(s.kind) ?? 0) + 1);
    }
  }
  return [...pages.entries()]
    .filter(([, acc]) => acc.trouble > 0)
    .map(([path, acc]) => {
      let topKind: SignalKind | null = null;
      for (const [kind, n] of acc.kinds) if (topKind === null || n > acc.kinds.get(topKind)!) topKind = kind;
      return { path, views: acc.views, trouble: acc.trouble, users: acc.users.size, topKind };
    })
    .sort((a, b) => b.trouble - a.trouble || b.users - a.users || a.path.localeCompare(b.path))
    .slice(0, limit);
}

// Median time in the app per user-day: first to last signal or event that day.
// Single-signal days count as zero. Null when there is nothing in the range.
export function medianDayLengthMs(
  events: EventRow[],
  signals: SignalRow[],
  start: Date | null,
): number | null {
  const spans = new Map<string, [number, number]>();
  const note = (userId: string, at: string) => {
    if (!inRange(at, start)) return;
    const t = Date.parse(at);
    const key = `${userId}|${dayKey(t)}`;
    const span = spans.get(key);
    if (!span) spans.set(key, [t, t]);
    else spans.set(key, [Math.min(span[0], t), Math.max(span[1], t)]);
  };
  for (const e of events) if (!e.estimated) note(e.userId, e.at);
  for (const s of signals) note(s.userId, s.at);
  return median([...spans.values()].map(([a, b]) => b - a));
}

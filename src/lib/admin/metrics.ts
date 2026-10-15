import type { UsageEvent } from "@/lib/usage/events";

// The admin panel's numbers, worked out from counts and first-event times. Pure, so it's tested
// without a database. Nothing here sees story text, answers or uploads.

// One user's progress, as counts read from their rows (see public.admin_user_progress()).
export type UserProgress = {
  id: string;
  email: string;
  signedUpAt: string;
  lastActiveAt: string;
  jobs: number;
  jobsWithQuestions: number;
  interviewDates: number;
  storiesStarted: number;
  storiesFinished: number;
  storiesGraded: number;
  aboutMeDone: boolean;
  assessmentDone: boolean;
  finderUsed: boolean;
  transcripts: number;
};

// When a user first did something, and how many times (see public.admin_event_firsts()).
// "estimated" marks a first worked out from data saved before tracking started.
export type EventFirst = {
  userId: string;
  event: UsageEvent;
  firstAt: string;
  times: number;
  estimated: boolean;
};

// The steps of the path a new user takes, in order. Drop-off is measured between neighbours.
export const FUNNEL_STEPS: readonly UsageEvent[] = [
  "sign_up",
  "job_added",
  "likely_questions_shown",
  "story_started",
  "story_finished",
  "story_graded",
  "about_me_finished",
];

export type FunnelStep = {
  event: UsageEvent;
  users: number;
  // Share of everyone who signed up, 0 to 1.
  ofAll: number;
  // Share of the previous step's users who reached this one, 0 to 1. 1 for the first step.
  ofPrevious: number;
};

export function funnel(users: UserProgress[], firsts: EventFirst[]): FunnelStep[] {
  const total = users.length;
  const ids = new Set(users.map((u) => u.id));
  const reached = new Map<UsageEvent, Set<string>>();
  for (const f of firsts) {
    if (!ids.has(f.userId)) continue;
    if (!reached.has(f.event)) reached.set(f.event, new Set());
    reached.get(f.event)!.add(f.userId);
  }
  let previous = total;
  return FUNNEL_STEPS.map((event) => {
    // Everyone listed has signed up, whether or not a sign-up event was recorded for them.
    const count = event === "sign_up" ? total : (reached.get(event)?.size ?? 0);
    const step = {
      event,
      users: count,
      ofAll: total === 0 ? 0 : count / total,
      ofPrevious: previous === 0 ? 0 : count / previous,
    };
    previous = count;
    return step;
  });
}

export type TimeToValue = {
  event: UsageEvent;
  // Users who got there, out of everyone.
  reached: number;
  total: number;
  medianMs: number | null;
  // True when any time used is estimated from data saved before tracking started.
  estimated: boolean;
};

// Time from sign-up to a user's first time doing `event`, across everyone who has done it.
export function timeToValue(
  users: UserProgress[],
  firsts: EventFirst[],
  event: UsageEvent,
): TimeToValue {
  const signedUp = new Map(users.map((u) => [u.id, Date.parse(u.signedUpAt)]));
  const durations: number[] = [];
  let estimated = false;
  for (const f of firsts) {
    if (f.event !== event) continue;
    const start = signedUp.get(f.userId);
    const at = Date.parse(f.firstAt);
    if (start === undefined || Number.isNaN(start) || Number.isNaN(at)) continue;
    durations.push(Math.max(0, at - start));
    estimated ||= f.estimated;
  }
  return {
    event,
    reached: durations.length,
    total: users.length,
    medianMs: median(durations),
    estimated,
  };
}

export type StoriesPerUser = { started: number; finished: number };

// Average stories per user, over everyone who signed up.
export function storiesPerUser(users: UserProgress[]): StoriesPerUser {
  if (users.length === 0) return { started: 0, finished: 0 };
  const sum = (pick: (u: UserProgress) => number) => users.reduce((n, u) => n + pick(u), 0);
  return {
    started: sum((u) => u.storiesStarted) / users.length,
    finished: sum((u) => u.storiesFinished) / users.length,
  };
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// "45 sec", "12 min", "3 h 20 min", "4 days".
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (ms < 60_000) return `${Math.max(0, Math.round(ms / 1000))} sec`;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    const rest = minutes % 60;
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  }
  return `${Math.round(hours / 24)} days`;
}

export function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

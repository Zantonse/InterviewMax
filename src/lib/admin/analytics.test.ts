import { describe, expect, it } from "vitest";
import {
  cohort,
  dailySeries,
  daysBetween,
  featureUsage,
  headline,
  medianDayLengthMs,
  parseRange,
  rangeStart,
  troublePages,
  type EventRow,
  type SignalRow,
} from "./analytics";
import type { EventFirst, UserProgress } from "./metrics";

function user(id: string, signedUpAt: string): UserProgress {
  return {
    id,
    email: `${id}@example.com`,
    signedUpAt,
    lastActiveAt: signedUpAt,
    jobs: 0,
    jobsWithQuestions: 0,
    interviewDates: 0,
    storiesStarted: 0,
    storiesFinished: 0,
    storiesGraded: 0,
    aboutMeDone: false,
    assessmentDone: false,
    finderUsed: false,
    transcripts: 0,
  };
}

const ev = (userId: string, event: EventRow["event"], at: string, estimated = false): EventRow => ({
  userId,
  event,
  at,
  estimated,
});
const sig = (userId: string, kind: SignalRow["kind"], path: string, at: string): SignalRow => ({
  userId,
  kind,
  path,
  at,
});

const NOW = new Date("2026-10-16T20:00:00Z");

describe("ranges", () => {
  it("falls back to 30 days for anything unknown", () => {
    expect(parseRange("7d")).toBe("7d");
    expect(parseRange("all")).toBe("all");
    expect(parseRange("bogus")).toBe("30d");
    expect(parseRange(undefined)).toBe("30d");
  });

  it("starts a 7-day range six days before today, at midnight UTC", () => {
    expect(rangeStart("7d", NOW)?.toISOString()).toBe("2026-10-10T00:00:00.000Z");
    expect(rangeStart("all", NOW)).toBeNull();
  });

  it("lists every day inclusive", () => {
    expect(daysBetween(new Date("2026-10-14T23:00:00Z"), NOW)).toEqual([
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
    ]);
  });
});

describe("dailySeries", () => {
  it("counts distinct active users, sign-ups, stories and trouble per day", () => {
    const days = ["2026-10-15", "2026-10-16"];
    const users = [user("a", "2026-10-15T09:00:00Z"), user("b", "2026-10-16T09:00:00Z")];
    const events = [
      ev("a", "story_started", "2026-10-15T10:00:00Z"),
      ev("a", "story_started", "2026-10-15T11:00:00Z"),
      ev("a", "story_finished", "2026-10-16T10:00:00Z"),
      ev("b", "job_added", "2026-10-16T10:00:00Z"),
    ];
    const signals = [
      sig("b", "page_view", "/home", "2026-10-16T10:00:00Z"),
      sig("b", "rage_click", "/home", "2026-10-16T10:01:00Z"),
      // Outside the days asked for: ignored.
      sig("b", "rage_click", "/home", "2026-10-14T10:01:00Z"),
    ];
    expect(dailySeries(days, users, events, signals)).toEqual([
      { day: "2026-10-15", activeUsers: 1, signUps: 1, storiesStarted: 2, storiesFinished: 0, troubleSignals: 0 },
      { day: "2026-10-16", activeUsers: 2, signUps: 1, storiesStarted: 0, storiesFinished: 1, troubleSignals: 1 },
    ]);
  });
});

describe("headline", () => {
  it("counts returning users as active on more than one day", () => {
    const start = new Date("2026-10-15T00:00:00Z");
    const users = [user("a", "2026-10-01T00:00:00Z"), user("b", "2026-10-15T08:00:00Z")];
    const events = [
      ev("a", "story_started", "2026-10-15T10:00:00Z"),
      ev("a", "story_finished", "2026-10-16T10:00:00Z"),
      ev("b", "story_started", "2026-10-15T10:00:00Z"),
      ev("b", "story_started", "2026-10-01T10:00:00Z"),
    ];
    expect(headline(users, events, [], start)).toEqual({
      activeUsers: 2,
      returningUsers: 1,
      signUps: 1,
      storiesStarted: 2,
      storiesFinished: 1,
      returningShare: 0.5,
    });
  });

  it("has no returning share when nobody was active", () => {
    expect(headline([], [], [], null).returningShare).toBeNull();
  });
});

describe("featureUsage", () => {
  it("ranks features by people, then times, and leaves out sign-up", () => {
    const events = [
      ev("a", "sign_up", "2026-10-15T10:00:00Z"),
      ev("a", "job_added", "2026-10-15T10:00:00Z"),
      ev("a", "job_added", "2026-10-15T11:00:00Z"),
      ev("a", "story_started", "2026-10-15T11:00:00Z"),
      ev("b", "story_started", "2026-10-15T11:00:00Z"),
    ];
    expect(featureUsage(events, null)).toEqual([
      { event: "story_started", times: 2, users: 2 },
      { event: "job_added", times: 2, users: 1 },
    ]);
  });
});

describe("cohort", () => {
  it("only follows people who signed up in the range", () => {
    const users = [user("old", "2026-09-01T00:00:00Z"), user("new", "2026-10-15T00:00:00Z")];
    const firsts: EventFirst[] = [
      { userId: "old", event: "story_finished", firstAt: "2026-10-15T00:00:00Z", times: 1, estimated: false },
      { userId: "new", event: "job_added", firstAt: "2026-10-15T00:10:00Z", times: 1, estimated: false },
    ];
    const result = cohort(users, firsts, new Date("2026-10-10T00:00:00Z"));
    expect(result.users).toBe(1);
    expect(result.funnel.find((s) => s.event === "job_added")?.users).toBe(1);
    expect(result.toStory.reached).toBe(0);
  });
});

describe("troublePages", () => {
  it("ranks pages by trouble and names the most common kind", () => {
    const signals = [
      sig("a", "page_view", "/jobs/:id", "2026-10-16T10:00:00Z"),
      sig("a", "dead_click", "/jobs/:id", "2026-10-16T10:01:00Z"),
      sig("b", "dead_click", "/jobs/:id", "2026-10-16T10:01:00Z"),
      sig("b", "error_shown", "/jobs/:id", "2026-10-16T10:02:00Z"),
      sig("a", "rage_click", "/home", "2026-10-16T10:01:00Z"),
      sig("a", "page_view", "/stories", "2026-10-16T10:01:00Z"),
    ];
    expect(troublePages(signals, null)).toEqual([
      { path: "/jobs/:id", views: 1, trouble: 3, users: 2, topKind: "dead_click" },
      { path: "/home", views: 0, trouble: 1, users: 1, topKind: "rage_click" },
    ]);
  });
});

describe("medianDayLengthMs", () => {
  it("takes first to last activity per user per day, skipping estimated events", () => {
    const events = [
      ev("a", "job_added", "2026-10-16T10:00:00Z"),
      ev("a", "story_started", "2026-10-16T10:30:00Z"),
      ev("b", "story_started", "2026-10-16T09:00:00Z", true),
    ];
    const signals = [sig("b", "page_view", "/home", "2026-10-16T12:00:00Z")];
    // a: 30 min, b: 0 (the estimated event is ignored).
    expect(medianDayLengthMs(events, signals, null)).toBe(15 * 60_000);
    expect(medianDayLengthMs([], [], null)).toBeNull();
  });
});

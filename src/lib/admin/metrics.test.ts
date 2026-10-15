import { describe, expect, it } from "vitest";
import {
  FUNNEL_STEPS,
  formatDuration,
  funnel,
  median,
  storiesPerUser,
  timeToValue,
  type EventFirst,
  type UserProgress,
} from "./metrics";

function user(id: string, overrides: Partial<UserProgress> = {}): UserProgress {
  return {
    id,
    email: `${id}@example.com`,
    signedUpAt: "2026-10-14T10:00:00Z",
    lastActiveAt: "2026-10-14T10:00:00Z",
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
    ...overrides,
  };
}

function first(userId: string, event: EventFirst["event"], firstAt: string, estimated = false) {
  return { userId, event, firstAt, times: 1, estimated };
}

describe("funnel", () => {
  it("counts users per step with drop-off from the step before", () => {
    const users = [user("a"), user("b"), user("c"), user("d")];
    const firsts = [
      first("a", "job_added", "2026-10-14T10:05:00Z"),
      first("b", "job_added", "2026-10-14T10:05:00Z"),
      first("a", "likely_questions_shown", "2026-10-14T10:06:00Z"),
    ];
    const steps = funnel(users, firsts);
    expect(steps.map((s) => s.event)).toEqual(FUNNEL_STEPS);
    expect(steps[0]).toMatchObject({ users: 4, ofAll: 1, ofPrevious: 1 });
    expect(steps[1]).toMatchObject({ users: 2, ofAll: 0.5, ofPrevious: 0.5 });
    expect(steps[2]).toMatchObject({ users: 1, ofAll: 0.25, ofPrevious: 0.5 });
    expect(steps[3]).toMatchObject({ users: 0, ofAll: 0, ofPrevious: 0 });
    // Nobody reached the step before, so no share to report.
    expect(steps[4]).toMatchObject({ users: 0, ofPrevious: 0 });
  });

  it("ignores events from users who aren't listed", () => {
    const steps = funnel([user("a")], [first("gone", "job_added", "2026-10-14T10:05:00Z")]);
    expect(steps[1].users).toBe(0);
  });

  it("handles no users", () => {
    expect(funnel([], []).every((s) => s.users === 0 && s.ofAll === 0)).toBe(true);
  });
});

describe("timeToValue", () => {
  it("takes the median time from sign-up to the first event", () => {
    const users = [
      user("a"),
      user("b"),
      user("c", { signedUpAt: "2026-10-14T12:00:00Z" }),
      user("d"),
    ];
    const firsts = [
      first("a", "likely_questions_shown", "2026-10-14T10:01:00Z"),
      first("b", "likely_questions_shown", "2026-10-14T10:03:00Z"),
      first("c", "likely_questions_shown", "2026-10-14T12:10:00Z", true),
      first("a", "story_finished", "2026-10-14T11:00:00Z"),
    ];
    const result = timeToValue(users, firsts, "likely_questions_shown");
    expect(result).toEqual({
      event: "likely_questions_shown",
      reached: 3,
      total: 4,
      medianMs: 3 * 60_000,
      estimated: true,
    });
  });

  it("is empty when nobody got there", () => {
    expect(timeToValue([user("a")], [], "story_finished")).toMatchObject({
      reached: 0,
      medianMs: null,
      estimated: false,
    });
  });

  it("never reports a negative time", () => {
    const result = timeToValue(
      [user("a")],
      [first("a", "job_added", "2026-10-14T09:00:00Z", true)],
      "job_added",
    );
    expect(result.medianMs).toBe(0);
  });
});

describe("storiesPerUser", () => {
  it("averages over everyone, including users with none", () => {
    const users = [user("a", { storiesStarted: 3, storiesFinished: 2 }), user("b")];
    expect(storiesPerUser(users)).toEqual({ started: 1.5, finished: 1 });
    expect(storiesPerUser([])).toEqual({ started: 0, finished: 0 });
  });
});

describe("median", () => {
  it("takes the middle value, or the mean of the two middle values", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("formatDuration", () => {
  it("reads naturally at each scale", () => {
    expect(formatDuration(45_000)).toBe("45 sec");
    expect(formatDuration(12 * 60_000)).toBe("12 min");
    expect(formatDuration(3 * 3_600_000)).toBe("3 h");
    expect(formatDuration(200 * 60_000)).toBe("3 h 20 min");
    expect(formatDuration(4 * 86_400_000)).toBe("4 days");
  });
});

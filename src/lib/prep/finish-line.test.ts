import { describe, expect, it } from "vitest";
import { emptyContent, type StoryContent } from "@/lib/stories/content";
import { CORE_STORY_GOAL, finishCounts, finishLine, paceLine } from "./finish-line";

const written = (writtenAt: string): StoryContent => ({
  ...emptyContent(),
  draft: { parts: { answer: "x" }, untracedNumbers: [], model: "m", writtenAt },
});

const story = (id: string, writtenAt?: string) => ({
  id,
  storyType: "major_project",
  content: writtenAt ? written(writtenAt) : emptyContent(),
});

describe("finish line", () => {
  it("counts written behavioral stories and whether today's is done, in the user's time zone", () => {
    const stories = [story("a", "2026-11-10T18:00:00Z"), story("b", "2026-11-12T07:00:00Z"), story("c")];
    // 07:00 UTC on Nov 12 is still Nov 11 in Los Angeles.
    const la = finishCounts({ stories, today: "2026-11-12", timeZone: "America/Los_Angeles" });
    expect(la).toMatchObject({ written: 2, doneToday: false });
    const utc = finishCounts({ stories, today: "2026-11-12", timeZone: "UTC" });
    expect(utc.doneToday).toBe(true);
    expect(finishCounts({ stories, today: "2026-11-12", exceptId: "b" }).written).toBe(1);
  });

  it("paces one a day without a date", () => {
    const line = finishLine({ written: 2, doneToday: false, today: "2026-11-12" });
    expect(line).toMatchObject({ goal: CORE_STORY_GOAL, perDay: 1, finishBy: "2026-11-15", days: null });
    expect(paceLine(line)).toBe("One a day and you're done by Sun, Nov 15.");
  });

  it("starts tomorrow once today's story is done", () => {
    const line = finishLine({ written: 5, doneToday: true, today: "2026-11-12" });
    expect(line.finishBy).toBe("2026-11-13");
    expect(paceLine(line)).toBe("One more and you're done, Fri, Nov 13.");
  });

  it("says how many days are left to practise before the interview", () => {
    const line = finishLine({
      written: 3,
      doneToday: false,
      today: "2026-11-12",
      interviewDate: "2026-11-20",
    });
    expect(line).toMatchObject({ perDay: 1, finishBy: "2026-11-14", spareDays: 5 });
    expect(paceLine(line)).toContain("with 5 days to practise before your interview");
  });

  it("asks for two a day when one a day won't finish in time, and narrows when even that won't", () => {
    const two = finishLine({ written: 0, doneToday: false, today: "2026-11-12", interviewDate: "2026-11-15" });
    expect(two.perDay).toBe(2);
    expect(paceLine(two)).toMatch(/^Two a day finishes before your interview/);
    const crunch = finishLine({ written: 0, doneToday: false, today: "2026-11-12", interviewDate: "2026-11-13" });
    expect(crunch.perDay).toBeGreaterThan(2);
    expect(paceLine(crunch)).toMatch(/top likely questions/);
  });

  it("is done at the goal", () => {
    const line = finishLine({ written: 7, doneToday: false, today: "2026-11-12" });
    expect(line.finishBy).toBeNull();
    expect(paceLine(line)).toMatch(/practise them out loud/);
  });
});

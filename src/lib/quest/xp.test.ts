import { describe, expect, it } from "vitest";
import { practiced, story } from "./test-fixtures";
import {
  heldUpInPractice,
  questLevel,
  rankFor,
  storiesSaidOutLoud,
  xpForClimb,
  xpForLevel,
  xpSummary,
} from "./xp";

describe("quest levels", () => {
  it("follows the story's level, with Level 4 once a Level 3 story holds up in practice", () => {
    const aloud = new Set(["a", "b"]);
    expect(questLevel(story("x", 0), aloud)).toBe(0);
    expect(questLevel(story("x", 1), aloud)).toBe(1);
    expect(questLevel(story("x", 2), aloud)).toBe(2);
    expect(questLevel(story("x", 3), aloud)).toBe(3);
    expect(questLevel(story("a", 3), aloud)).toBe(4);
    // Practiced but only Level 2: practice doesn't skip a level.
    expect(questLevel(story("b", 2), aloud)).toBe(2);
  });

  it("leaves About me and tough questions out", () => {
    expect(questLevel(story("x", 3, { type: "about_me" }), new Set(["x"]))).toBe(0);
  });

  it("counts a practice answer only with feedback, a follow-up answered, and no drift", () => {
    expect(heldUpInPractice(practiced("a"))).toBe(true);
    expect(heldUpInPractice(practiced("a", { closeness: "partly" }))).toBe(true);
    expect(heldUpInPractice(practiced("a", { followUp: false }))).toBe(false);
    expect(heldUpInPractice(practiced("a", { closeness: "drifted" }))).toBe(false);
    expect(heldUpInPractice(practiced("a", { feedback: false }))).toBe(false);
    expect(heldUpInPractice(practiced("a", { skipped: true }))).toBe(false);
    const aloud = storiesSaidOutLoud([
      { targetJobId: "j", items: [practiced("a"), practiced(undefined), practiced("b", { closeness: "drifted" })] },
    ]);
    expect([...aloud]).toEqual(["a"]);
  });
});

describe("XP", () => {
  it("is 500 for one story from Level 1 to Level 4", () => {
    expect(xpForLevel(0)).toBe(0);
    expect(xpForLevel(1)).toBe(50);
    expect(xpForLevel(2)).toBe(150);
    expect(xpForLevel(3)).toBe(350);
    expect(xpForLevel(4)).toBe(500);
    expect(xpForClimb(1, 3)).toBe(300);
    expect(xpForClimb(3, 2)).toBe(0);
  });

  it("adds stories, skills, boss rounds and read interviews, and nothing else", () => {
    const summary = xpSummary({
      stories: [story("a", 3), story("b", 2), story("c", 0), story("d", 3, { type: "about_me" })],
      sessions: [{ targetJobId: "j", items: [practiced("a")] }],
      transcripts: [{ analysis: {} }, { analysis: null }],
      skillsLearned: 2,
      bossRounds: 1,
    });
    // a: 500, b: 150, skills 200, boss 300, one read interview 75.
    expect(summary.total).toBe(500 + 150 + 200 + 300 + 75);
    expect(summary.lines.find((l) => l.id === "level2")).toMatchObject({ count: 2, xp: 200 });
    expect(summary.lines.find((l) => l.id === "interviews")).toMatchObject({ count: 1 });
  });

  it("is zero with nothing done", () => {
    expect(xpSummary({ stories: [], sessions: [] }).total).toBe(0);
  });
});

describe("ranks", () => {
  it("climbs at 500, 1,500, 3,000 and 4,500 XP", () => {
    expect(rankFor(0)).toMatchObject({ number: 1, name: "Getting started", nextAt: 500, progress: 0 });
    expect(rankFor(250).progress).toBe(0.5);
    expect(rankFor(500)).toMatchObject({ number: 2, name: "Storyteller", nextAt: 1500 });
    expect(rankFor(3000).name).toBe("Interview ready");
    expect(rankFor(9999)).toMatchObject({ number: 5, nextAt: null, nextName: null, progress: 1 });
  });
});

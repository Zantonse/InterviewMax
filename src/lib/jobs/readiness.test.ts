import { describe, expect, it } from "vitest";
import type { LikelyQuestion } from "@/lib/questions/content";
import type { StoryContent } from "@/lib/stories/content";
import { questionReadiness, readyLevelOf } from "./readiness";

const at = "2026-11-11T00:00:00Z";
const q = (question: string, theme: string) =>
  ({ question, theme, why: "", source: "common", specific: false }) as LikelyQuestion;
const grade = (tier: string, thinking?: string) => ({
  tier,
  fixes: [],
  strengths: [],
  criteria: [],
  checks: [],
  flags: [],
  model: "m",
  draftWrittenAt: at,
  gradedAt: at,
  ...(thinking ? { thinking: { level: thinking, note: "" } } : {}),
});
const story = (id: string, storyType: string, extra: Partial<StoryContent> = {}) => ({
  id,
  title: id,
  storyType,
  content: { version: 1, answers: { start: "x" }, ...extra } as StoryContent,
});
const draft = { parts: { situation: "s" }, untracedNumbers: [], model: "m", writtenAt: at };

describe("readyLevelOf", () => {
  it("is 0 before the story is written and 1 once written but not graded", () => {
    expect(readyLevelOf(story("a", "difficult_stakeholder"))).toBe(0);
    expect(readyLevelOf(story("a", "difficult_stakeholder", { draft }))).toBe(1);
  });

  it("follows the story levels for a behavioral story", () => {
    const content = { draft, grade: grade("strong", "partly") } as unknown as Partial<StoryContent>;
    expect(readyLevelOf(story("a", "difficult_stakeholder", content))).toBe(2);
  });

  it("maps About me's tier to a level", () => {
    const content = { draft, grade: grade("strong") } as unknown as Partial<StoryContent>;
    expect(readyLevelOf(story("a", "about_me", content))).toBe(3);
  });
});

describe("questionReadiness", () => {
  it("gives each likely question its story's level, or the type to build, and counts Level 2+", () => {
    const graded = { draft, grade: grade("good_enough") } as unknown as Partial<StoryContent>;
    const result = questionReadiness(
      [q("A hard stakeholder?", "conflict"), q("A failure?", "failure")],
      [story("vp", "difficult_stakeholder", graded)],
    );
    expect(result.rows).toEqual([
      { question: "A hard stakeholder?", kind: "story", storyId: "vp", title: "vp", level: 2 },
      { question: "A failure?", kind: "build", storyType: "went_wrong" },
    ]);
    expect(result.ready).toBe(1);
    expect(result.total).toBe(2);
  });

  it("is empty with no likely questions", () => {
    expect(questionReadiness(undefined, [])).toEqual({ rows: [], ready: 0, total: 0 });
  });
});

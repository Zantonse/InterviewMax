import { describe, expect, it } from "vitest";
import { parseContent } from "./content";
import type { CheckResult, CriterionScore, StoryGrade } from "./grading";
import {
  levelForGrade,
  levelGaps,
  levelScore,
  levelUpInstructions,
  needsAnswers,
  parseLevelUp,
  storyLevel,
  usesLevels,
} from "./levels";
import { getStoryType } from "./story-types";

const star = getStoryType("difficult_stakeholder");
const aboutMe = getStoryType("about_me");

const ids = ["context", "ownership", "actions", "result", "reflection"];
const crit = (scores: number[]): CriterionScore[] =>
  ids.map((id, i) => ({ id, score: scores[i], note: `${id} note`, improve: `raise ${id}` }));
const checks = (failing: string[] = []): CheckResult[] =>
  ["number", "traced", "i_we", "length", "filler", "hedged"].map((id) => ({
    id: id as CheckResult["id"],
    pass: !failing.includes(id),
    detail: `${id} detail`,
  }));

function grade(over: Partial<StoryGrade>): StoryGrade {
  return {
    tier: "good_enough",
    fixes: [],
    strengths: [],
    criteria: crit([3, 3, 3, 3, 3]),
    checks: checks(),
    flags: [],
    model: "test",
    draftWrittenAt: "w1",
    gradedAt: "g1",
    ...over,
  };
}

describe("levels", () => {
  it("only behavioral stories use levels", () => {
    expect(usesLevels(star)).toBe(true);
    expect(usesLevels(aboutMe)).toBe(false);
    expect(usesLevels(star, { version: 1, answers: {}, tough: {} })).toBe(false);
  });

  it("maps tiers to levels, holding Strong at Level 2 until the thinking is shown", () => {
    expect(levelForGrade(grade({ tier: "not_yet" }))).toBe(1);
    expect(levelForGrade(grade({ tier: "good_enough" }))).toBe(2);
    expect(levelForGrade(grade({ tier: "strong", thinking: { level: "partly", note: "" } }))).toBe(
      2,
    );
    expect(levelForGrade(grade({ tier: "strong", thinking: { level: "shown", note: "" } }))).toBe(
      3,
    );
    // Older grades with no thinking feedback aren't held back.
    expect(levelForGrade(grade({ tier: "strong" }))).toBe(3);
  });

  it("is Level 1 for a draft with no current grade", () => {
    const content = {
      version: 1 as const,
      answers: {},
      draft: { parts: {}, untracedNumbers: [], model: "", writtenAt: "w2" },
      grade: grade({ tier: "strong" }),
    };
    expect(storyLevel(content, star)).toBe(1);
    expect(storyLevel({ ...content, grade: grade({ draftWrittenAt: "w2" }) }, star)).toBe(2);
    expect(storyLevel({ version: 1, answers: {} }, star)).toBeUndefined();
  });

  it("caps the score at 89 while the thinking holds a Strong story at Level 2", () => {
    const strong = grade({
      tier: "strong",
      criteria: crit([4, 4, 4, 4, 4]),
      thinking: { level: "missing", note: "" },
    });
    expect(levelScore(strong)).toBe(89);
    expect(levelScore({ ...strong, thinking: { level: "shown", note: "" } })).toBe(100);
  });

  it("lists the gaps to Level 2: the number first, then thin core parts", () => {
    const gaps = levelGaps(
      grade({ tier: "not_yet", criteria: crit([2, 1, 3, 2, 1]), checks: checks(["number"]) }),
    );
    expect(gaps.map((g) => g.id)).toEqual(["number", "ownership", "context"]);
    expect(gaps[0]).toMatchObject({ gap: "result", detail: "number detail" });
    // Reflection isn't needed for Level 2.
    expect(gaps.some((g) => g.id === "reflection")).toBe(false);
  });

  it("lists the gaps to Level 3: thinking first, then parts under Solid, then rewrite-only checks", () => {
    const gaps = levelGaps(
      grade({
        tier: "good_enough",
        criteria: crit([3, 3, 3, 3, 2]),
        checks: checks(["length"]),
        thinking: { level: "missing", note: "", improve: "Say why you chose it." },
      }),
    );
    expect(gaps.map((g) => g.id)).toEqual(["thinking", "reflection", "length"]);
    expect(gaps[0]).toMatchObject({ gap: "decision", detail: "Say why you chose it." });
    expect(gaps[2].gap).toBeUndefined();
    expect(needsAnswers(gaps)).toBe(true);
    expect(needsAnswers([gaps[2]])).toBe(false);
  });

  it("has no gaps at the top level", () => {
    expect(levelGaps(grade({ tier: "strong", thinking: { level: "shown", note: "" } }))).toEqual(
      [],
    );
  });

  it("aims the level-up round at the gaps only", () => {
    const text = levelUpInstructions(
      3,
      [{ id: "thinking", gap: "decision", label: "Your thinking", detail: "Say why." }],
      3,
    );
    expect(text).toContain("Level 3");
    expect(text).toContain('gap "decision"');
    expect(text).toContain("Ask exactly one question");
  });

  it("parses a saved level-up and keeps it through parseContent", () => {
    const raw = {
      from: 1,
      target: 2,
      before: { result: "x", bad: 3 },
      startedAt: "t",
      round: 2,
      reached: 2,
    };
    expect(parseLevelUp(raw)).toEqual({
      from: 1,
      target: 2,
      before: { result: "x" },
      startedAt: "t",
      round: 2,
      reached: 2,
    });
    expect(parseLevelUp({ from: 4, target: 2, before: {} })).toBeUndefined();
    const content = parseContent({ answers: {}, levelUp: raw, levelReached: 2 });
    expect(content.levelUp?.target).toBe(2);
    expect(content.levelReached).toBe(2);
  });
});

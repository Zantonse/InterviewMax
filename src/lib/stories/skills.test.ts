import { describe, expect, it } from "vitest";
import type { StoryContent } from "./content";
import type { StoryGrade } from "./grading";
import {
  aidedSkills,
  nextStep,
  skillEvidence,
  skillLevel,
  skillsMap,
  spotChoices,
  spotHint,
  spotOutcome,
  spotTargets,
  weakSkillsInstructions,
  weakestSkills,
  type SkillEvidence,
} from "./skills";

const ids = ["context", "ownership", "actions", "result", "reflection"];
function story(
  id: string,
  scores: number[],
  opts: { gaps?: string[]; thinking?: "shown" | "partly" | "missing"; type?: string } = {},
) {
  const grade: StoryGrade = {
    tier: "good_enough",
    fixes: [],
    strengths: [],
    criteria: ids.map((c, i) => ({ id: c, score: scores[i], note: "" })),
    checks: [],
    flags: [],
    model: "x",
    draftWrittenAt: "w",
    gradedAt: "g",
    ...(opts.thinking ? { thinking: { level: opts.thinking, note: "" } } : {}),
  };
  const content: StoryContent = {
    version: 1,
    answers: {},
    draft: { parts: {}, untracedNumbers: [], model: "x", writtenAt: "w" },
    grade,
    followUps: (opts.gaps ?? []).map((gap) => ({ question: "q", gap, answer: "a" })),
  };
  return { id, storyType: opts.type ?? "difficult_stakeholder", content };
}

const ev = (score: number, unaided: boolean): SkillEvidence => ({ storyId: "s", score, unaided });

describe("skill levels", () => {
  it("climbs 0 to 5 by stories shown, with unaided ones needed from Learned up", () => {
    expect(skillLevel([])).toBe(0);
    expect(skillLevel([ev(2, true)])).toBe(1);
    expect(skillLevel([ev(3, false)])).toBe(2);
    // Twice, but both times after a question pointed at it: still Shown once.
    expect(skillLevel([ev(3, false), ev(3, false)])).toBe(2);
    expect(skillLevel([ev(3, false), ev(3, true)])).toBe(3);
    expect(skillLevel([ev(4, false), ev(4, true)])).toBe(4);
    expect(skillLevel([ev(4, false), ev(4, true), ev(4, true)])).toBe(5);
    expect(skillLevel([ev(4, false), ev(4, false), ev(4, true)])).toBe(4);
  });

  it("says what gets each level to the next", () => {
    expect(nextStep(2, [ev(3, false), ev(3, false)])).toMatch(/before I ask/);
    expect(nextStep(5, [])).toBeUndefined();
  });

  it("counts a skill as aided when an answered follow-up asked about it", () => {
    const aided = aidedSkills([
      { question: "q", gap: "result", answer: "a" },
      { question: "q", gap: "decision", answer: "" },
      { question: "q", gap: "situation", answer: "a" },
    ]);
    expect([...aided].sort()).toEqual(["result", "stakes"]);
  });

  it("reads evidence from graded behavioral stories only", () => {
    const evidence = skillEvidence([
      story("a", [3, 3, 3, 3, 2], { gaps: ["result"], thinking: "shown" }),
      story("b", [4, 4, 4, 4, 4], { type: "about_me" }),
    ]);
    expect(evidence.result).toEqual([{ storyId: "a", score: 3, unaided: false }]);
    expect(evidence.stakes[0].unaided).toBe(true);
    expect(evidence.thinking[0].score).toBe(4);
    expect(evidence.ownership).toHaveLength(1);
  });

  it("maps skills across stories and picks the weakest to ask about", () => {
    const map = skillsMap([
      story("a", [3, 2, 3, 3, 1], { gaps: ["result"] }),
      story("b", [3, 3, 3, 3, 1], { gaps: ["result"] }),
    ]);
    const level = (id: string) => map.find((s) => s.skill.id === id)?.level;
    expect(level("stakes")).toBe(3);
    expect(level("result")).toBe(2);
    expect(level("lesson")).toBe(1);
    expect(level("thinking")).toBe(0);
    expect(weakestSkills(map).map((s) => s.id)).toEqual(["lesson", "ownership"]);
    expect(weakSkillsInstructions(weakestSkills(map))).toContain("The lesson");
    expect(weakestSkills(skillsMap([]))).toEqual([]);
  });
});

describe("spot it yourself", () => {
  const gaps = [
    { id: "thinking", gap: "decision", label: "", detail: "" },
    { id: "length", label: "", detail: "" },
    { id: "number", gap: "result", label: "", detail: "" },
  ];

  it("turns the level gaps into skills to spot, leaving out rewrite-only ones", () => {
    expect(spotTargets(gaps)).toEqual(["thinking", "result"]);
    expect(spotTargets([{ id: "length", label: "", detail: "" }])).toEqual([]);
  });

  it("offers thinking and the lesson only for Level 3", () => {
    expect(spotChoices(2).map((s) => s.id)).not.toContain("thinking");
    expect(spotChoices(3)).toHaveLength(6);
  });

  it("gives a hint on the first miss and the answer on the second", () => {
    const targets = spotTargets(gaps);
    expect(spotOutcome("result", targets, 0)).toBe("found");
    expect(spotOutcome("stakes", targets, 0)).toBe("hint");
    expect(spotOutcome("stakes", targets, 1)).toBe("revealed");
    expect(spotHint(targets)).toContain("What you did");
  });
});

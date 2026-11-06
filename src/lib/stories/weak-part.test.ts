import { describe, expect, it } from "vitest";
import {
  MAX_FIX_ASKS,
  parseContent,
  partToFix,
  weakIntroPart,
  type FollowUp,
  type StoryContent,
} from "./content";
import type { CriterionScore, StoryGrade } from "./grading";
import { INTRO_PROBE_SYSTEM, weakPartProbeSystem, writeMessages } from "./prompts";
import { getStoryType, REQUIRED_STORY_TYPE_ID } from "./story-types";

const aboutMe = getStoryType(REQUIRED_STORY_TYPE_ID);
const WRITTEN = "2026-11-04T23:35:39.605Z";

function scores(overrides: Record<string, number> = {}): CriterionScore[] {
  return ["present", "path", "highlight", "strengths", "next", "thread"].map((id) => ({
    id,
    score: overrides[id] ?? 3,
    note: `${id} note`,
    improve: overrides[id] && overrides[id] < 4 ? `Raise ${id}` : "",
  }));
}

function graded(
  overrides: Record<string, number> = {},
  followUps?: FollowUp[],
  gradedFor = WRITTEN,
): StoryContent {
  return {
    version: 1,
    answers: { now: "Designer at Nextdoor", next: "a big company" },
    followUps,
    draft: {
      parts: { present: "P", path: "Pa", highlight: "H", strengths: "S", next: "N" },
      untracedNumbers: [],
      model: "m",
      writtenAt: WRITTEN,
    },
    grade: {
      tier: "good_enough",
      fixes: [],
      strengths: [],
      criteria: scores(overrides),
      checks: [],
      flags: [],
      model: "g",
      draftWrittenAt: gradedFor,
      gradedAt: WRITTEN,
    } as StoryGrade,
  };
}

describe("weakIntroPart", () => {
  it("finds a part scored 2 or lower, with the grader's advice", () => {
    const part = weakIntroPart(graded({ next: 2 }), aboutMe);
    expect(part).toMatchObject({ id: "next", label: "Why this next role", score: 2 });
    expect(part?.improve).toBe("Raise next");
  });

  it("picks the lowest score, and the earlier part on a tie", () => {
    expect(weakIntroPart(graded({ path: 2, next: 1 }), aboutMe)?.id).toBe("next");
    expect(weakIntroPart(graded({ path: 2, next: 2 }), aboutMe)?.id).toBe("path");
  });

  it("ignores criteria that aren't parts, and parts scored 3 or more", () => {
    expect(weakIntroPart(graded({ thread: 1 }), aboutMe)).toBeUndefined();
    expect(weakIntroPart(graded(), aboutMe)).toBeUndefined();
  });

  it("needs a current grade on a 'Tell me about yourself'", () => {
    expect(weakIntroPart(graded({ next: 2 }, undefined, "older"), aboutMe)).toBeUndefined();
    expect(weakIntroPart(graded({ next: 2 }), getStoryType("cross_team"))).toBeUndefined();
  });

  it("waits while a question is open, and stops after the last ask for that part", () => {
    const open: FollowUp = { question: "Q", gap: "next", round: 2, fixes: "next" };
    expect(weakIntroPart(graded({ next: 2 }, [open]), aboutMe)).toBeUndefined();
    const asked = Array.from({ length: MAX_FIX_ASKS }, (_, i) => ({
      ...open,
      round: i + 2,
      answer: "A",
    }));
    expect(weakIntroPart(graded({ next: 2, path: 2 }, asked), aboutMe)?.id).toBe("path");
  });
});

describe("partToFix", () => {
  const fix: FollowUp = { question: "Q", gap: "next", round: 2, fixes: "next", answer: "Meta ads" };

  it("is the part the latest round's answered question fixes", () => {
    expect(partToFix(graded({}, [{ question: "Old", gap: "path", round: 1 }, fix]))).toBe("next");
  });

  it("is nothing once applied, unanswered, or for an ordinary round", () => {
    expect(partToFix(graded({}, [{ ...fix, applied: true }]))).toBeUndefined();
    expect(partToFix(graded({}, [{ ...fix, answer: undefined }]))).toBeUndefined();
    expect(partToFix(graded({}, [{ question: "Q", gap: "next", round: 2, answer: "A" }]))).toBe(
      undefined,
    );
  });

  it("survives a save and load", () => {
    const loaded = parseContent(JSON.parse(JSON.stringify(graded({}, [fix]))));
    expect(loaded.followUps?.[0]).toMatchObject({ fixes: "next", answer: "Meta ads" });
    const applied = parseContent({ version: 1, answers: {}, followUps: [{ ...fix, applied: true }] });
    expect(applied.followUps?.[0].applied).toBe(true);
  });
});

describe("weak-part prompts", () => {
  it("asks one question about that part only, with the grader's note", () => {
    const part = weakIntroPart(graded({ next: 2 }), aboutMe)!;
    const system = weakPartProbeSystem(aboutMe, part, 3);
    expect(system).toContain("Ask exactly one question");
    expect(system).toContain('"Why this next role" (next)');
    expect(system).toContain("next note");
    expect(system).toContain("Raise next");
  });

  it("asks about a generic 'what next' in the first round", () => {
    expect(INTRO_PROBE_SYSTEM).toContain("one of your questions must ask about it");
  });

  it("rewrites one part and keeps the rest", () => {
    const content = graded({ next: 2 });
    const messages = writeMessages(content, aboutMe, undefined, [], undefined, {
      part: "next",
      previous: content.draft!.parts,
    });
    expect(messages).toHaveLength(3);
    expect(messages[1]).toMatchObject({ role: "assistant" });
    expect(messages[1].content).toContain('"next":"N"');
    expect(messages[2].content).toContain('Rewrite only the "next" part');
  });
});

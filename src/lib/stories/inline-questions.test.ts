import { describe, expect, it } from "vitest";
import type { StoryContent } from "./content";
import { END_OF_STORY, inlineLevelQuestions } from "./inline-questions";

function story(extra: Partial<StoryContent> = {}): StoryContent {
  return {
    answers: {},
    draft: {
      parts: { situation: "Booking lost 38%.", role: "I was PM.", actions: "I chose the overnight check.", result: "Drop-off fell." },
      untracedNumbers: [],
      model: "m",
      writtenAt: "2026-11-17T00:00:00Z",
    },
    levelUp: { from: 2, target: 3, before: {}, startedAt: "2026-11-17T00:00:00Z", round: 2 },
    followUps: [
      { question: "Old one", gap: "result", round: 1 },
      { question: "Why overnight?", gap: "decision", round: 2 },
      { question: "What did you learn?", gap: "reflection", round: 2 },
      { question: "Answered", gap: "result", round: 2, answer: "yes" },
      { question: "Skipped", gap: "result", round: 2, skipped: true },
    ],
    ...extra,
  } as StoryContent;
}

describe("inlineLevelQuestions", () => {
  it("puts this round's open questions under the paragraph they improve", () => {
    const qs = inlineLevelQuestions(story());
    expect(qs.map((q) => [q.index, q.part, q.label])).toEqual([
      [1, "actions", "Your thinking"],
      [2, END_OF_STORY, "The lesson"],
    ]);
  });

  it("is empty once the level-up is done or wasn't asked", () => {
    const done = story();
    done.levelUp = { ...done.levelUp!, reached: 3 };
    expect(inlineLevelQuestions(done)).toEqual([]);
    const noRound = story();
    delete noRound.levelUp!.round;
    expect(inlineLevelQuestions(noRound)).toEqual([]);
  });
});

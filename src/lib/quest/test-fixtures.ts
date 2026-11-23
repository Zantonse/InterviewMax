// Test fixtures for Story Quest: stories at a given level, and practice items.
import type { PracticeItem } from "@/lib/practice/content";
import type { StoryContent } from "@/lib/stories/content";
import type { StoryGrade } from "@/lib/stories/grading";
import type { QuestStory } from "./xp";

const CRITERIA = ["context", "ownership", "actions", "result", "reflection"];

// level: 0 = started, no draft; 1 = written, ungraded; 2 = Good enough; 3 = Strong, thinking shown.
export function story(
  id: string,
  level: 0 | 1 | 2 | 3,
  opts: { type?: string; updatedAt?: string; scores?: number[]; title?: string } = {},
): QuestStory {
  const scores = opts.scores ?? (level === 3 ? [4, 4, 4, 4, 4] : [3, 3, 3, 3, 3]);
  const grade: StoryGrade | undefined =
    level >= 2
      ? {
          tier: level === 3 ? "strong" : "good_enough",
          fixes: [],
          strengths: [],
          criteria: CRITERIA.map((c, i) => ({ id: c, score: scores[i], note: "" })),
          checks: [],
          flags: [],
          model: "x",
          draftWrittenAt: "w",
          gradedAt: "g",
          thinking: { level: level === 3 ? "shown" : "partly", note: "" },
        }
      : undefined;
  const content: StoryContent = {
    version: 1,
    answers: {},
    ...(level >= 1 ? { draft: { parts: {}, untracedNumbers: [], model: "x", writtenAt: "w" } } : {}),
    ...(grade ? { grade } : {}),
  };
  return {
    id,
    title: opts.title ?? `Story ${id}`,
    storyType: opts.type ?? "difficult_stakeholder",
    content,
    updatedAt: opts.updatedAt ?? "2026-11-01T00:00:00Z",
  };
}

export function practiced(
  storyId: string | undefined,
  opts: {
    followUp?: boolean;
    closeness?: "close" | "partly" | "drifted" | "no_story";
    feedback?: boolean;
    question?: string;
    skipped?: boolean;
  } = {},
): PracticeItem {
  const { followUp = true, closeness = "close", feedback = true } = opts;
  return {
    question: opts.question ?? "Tell me about a time…",
    theme: "conflict",
    reason: "strong",
    ...(storyId ? { storyId } : {}),
    turns: [
      { question: "Tell me about a time…", answer: "I did it." },
      ...(followUp ? [{ question: "Why?", gap: "decision", answer: "Because." }] : []),
    ],
    ...(opts.skipped ? { skipped: true } : {}),
    ...(feedback && !opts.skipped
      ? {
          feedback: {
            summary: "",
            closeness,
            closenessNote: "",
            landed: [],
            missing: [],
            followUpsNote: "",
            numbersLeftOut: [],
            timing: { seconds: 60, measured: false, words: 150, min: 60, max: 120 },
            newFacts: [],
            model: "x",
            givenAt: "g",
          },
        }
      : {}),
  };
}

import { describe, expect, it } from "vitest";
import type { LikelyQuestion } from "@/lib/questions/content";
import { emptyContent, type StoryContent } from "@/lib/stories/content";
import type { StoryGrade } from "@/lib/stories/grading";
import {
  type PracticeItem,
  checkNewFacts,
  currentItemIndex,
  itemStep,
  numbersLeftOut,
  parseItems,
  pickQuestions,
  timingFor,
  timingNote,
  timingVerdict,
} from "./content";
import { exchangeTranscript, parseFeedback, parseProbe, probeHints } from "./prompts";

const WRITTEN = "2026-10-15T00:00:00Z";

function written(tier?: StoryGrade["tier"], stale = false): StoryContent {
  return {
    ...emptyContent(),
    draft: { parts: {}, untracedNumbers: [], model: "t", writtenAt: WRITTEN },
    ...(tier
      ? {
          grade: {
            tier,
            fixes: [],
            strengths: [],
            criteria: [],
            checks: [],
            flags: [],
            model: "t",
            draftWrittenAt: stale ? "earlier" : WRITTEN,
            gradedAt: WRITTEN,
          },
        }
      : {}),
  };
}

const story = (id: string, storyType: string, content: StoryContent = emptyContent()) => ({
  id,
  title: `Story ${id}`,
  storyType,
  content,
});

const q = (theme: string, question = `A ${theme} question?`): LikelyQuestion => ({
  question,
  theme: theme as LikelyQuestion["theme"],
  why: "",
  source: "common",
  specific: false,
});

describe("pickQuestions", () => {
  const questions = [
    q("about_you"),
    q("impact"),
    q("conflict"),
    q("failure"),
    q("prioritization"),
    q("collaboration"),
    q("success"),
  ];

  it("puts gaps first, then unwritten, then weaker stories, keeping the likely order", () => {
    const stories = [
      story("intro", "about_me", written("strong")),
      story("proj", "major_project", written("not_yet")),
      story("stake", "difficult_stakeholder", emptyContent()),
      story("prio", "prioritization", written("good_enough")),
      story("cross", "cross_team", written()),
    ];
    const round = pickQuestions(questions, stories);
    expect(round.map((i) => [i.theme, i.reason])).toEqual([
      ["failure", "gap"],
      ["conflict", "unwritten"],
      ["impact", "not_yet"],
      ["success", "not_yet"],
      ["collaboration", "ungraded"],
    ]);
    expect(round[2]).toMatchObject({ storyId: "proj", storyTitle: "Story proj" });
    expect(round[0].storyId).toBeUndefined();
    expect(round[0].turns).toEqual([{ question: "A failure question?" }]);
  });

  it("treats a grade for an older draft as ungraded", () => {
    const round = pickQuestions([q("impact")], [story("p", "major_project", written("strong", true))]);
    expect(round[0].reason).toBe("ungraded");
  });

  it("takes five at most, fewer when the job has fewer", () => {
    expect(pickQuestions(questions, [])).toHaveLength(5);
    expect(pickQuestions(questions.slice(0, 2), [])).toHaveLength(2);
  });
});

describe("a question's steps", () => {
  const base: PracticeItem = {
    question: "Tell me about a time you failed.",
    theme: "failure",
    reason: "gap",
    turns: [{ question: "Tell me about a time you failed." }],
  };

  it("answer, follow-ups up to two, then feedback", () => {
    expect(itemStep(base)).toBe("answer");
    const answered = { ...base, turns: [{ ...base.turns[0], answer: "I missed a launch." }] };
    expect(itemStep(answered)).toBe("probe");
    const followed = { ...answered, turns: [...answered.turns, { question: "What did you change?" }] };
    expect(itemStep(followed)).toBe("answer");
    const two = {
      ...followed,
      turns: [
        answered.turns[0],
        { question: "a", answer: "x" },
        { question: "b", answer: "y" },
      ],
    };
    expect(itemStep(two)).toBe("feedback");
    expect(itemStep({ ...answered, probeDone: true })).toBe("feedback");
    expect(itemStep({ ...base, skipped: true })).toBe("done");
  });

  it("the round is on the first question not done", () => {
    expect(currentItemIndex([{ ...base, skipped: true }, base])).toBe(1);
    expect(currentItemIndex([{ ...base, skipped: true }])).toBe(-1);
  });
});

describe("timing", () => {
  it("uses the recorded time when there is one", () => {
    const t = timingFor({ question: "q", answer: "word ".repeat(200), seconds: 95 }, "impact");
    expect(t).toMatchObject({ seconds: 95, measured: true, words: 200, min: 72, max: 120 });
    expect(timingVerdict(t)).toBe("ok");
    expect(timingNote(t)).toContain("right in range");
  });

  it("works it out from the words when typed, with the intro's shorter target", () => {
    const t = timingFor({ question: "q", answer: "word ".repeat(300) }, "about_you");
    expect(t).toMatchObject({ seconds: 120, measured: false, min: 48, max: 90 });
    expect(timingVerdict(t)).toBe("long");
    expect(timingNote(t)).toContain("estimated");
  });

  it("flags a short answer", () => {
    const t = timingFor({ question: "q", answer: "word ".repeat(40) }, "impact");
    expect(timingVerdict(t)).toBe("short");
  });
});

describe("checks in code", () => {
  it("lists the story's figures the user never said, but not years", () => {
    const storyText = "Since 2019 I ran 12 accounts. We renewed the $2.4M contract, 20% above plan.";
    expect(numbersLeftOut(storyText, "I renewed it at 2.4 million")).toEqual(["12", "20%"]);
  });

  it("keeps a new fact only when its quote was said and its numbers are in the quote", () => {
    const spoken = "So I called the CFO myself, and honestly we cut churn by 15% in two quarters.";
    const kept = checkNewFacts(
      [
        { fact: "I called the CFO myself.", quote: "I called the CFO myself" },
        { fact: "I cut churn by 15% in two quarters.", quote: "we cut churn by 15% in two quarters" },
        { fact: "I cut churn by 25%.", quote: "we cut churn by 15%" },
        { fact: "I hired three people.", quote: "I hired three people to help" },
      ],
      spoken,
    );
    expect(kept.map((f) => f.fact)).toEqual([
      "I called the CFO myself.",
      "I cut churn by 15% in two quarters.",
    ]);
  });

  it("gives the interviewer hints about a vague answer", () => {
    expect(probeHints("We fixed it and we shipped it.")).toEqual([
      "- They haven't said a single number.",
      '- They said "we" 2 times and "I" 0 times.',
    ]);
    expect(probeHints("I cut costs by 20%.")).toEqual([]);
  });
});

describe("model replies", () => {
  it("reads a follow-up, or none", () => {
    expect(parseProbe('{"followUp": {"question": "What did you do yourself?", "gap": "ownership"}}')).toEqual({
      question: "What did you do yourself?",
      gap: "ownership",
    });
    expect(parseProbe('{"followUp": null}')).toBeNull();
    expect(parseProbe("not json")).toBeNull();
  });

  it("reads feedback, with no new facts or closeness when there's no saved story", () => {
    const text = JSON.stringify({
      summary: "Clear, but the result was missing.",
      closeness: "close",
      closenessNote: "x",
      landed: ["a", "b", "c"],
      missing: ["m"],
      followUpsNote: "f",
      newFacts: [{ fact: "f", quote: "q" }],
    });
    expect(parseFeedback(text, false)).toMatchObject({
      closeness: "no_story",
      landed: ["a", "b"],
      newFacts: [],
    });
    expect(parseFeedback(text, true)).toMatchObject({ closeness: "close", newFacts: [{ fact: "f" }] });
    expect(() => parseFeedback("{}", true)).toThrow();
  });

  it("writes the exchange as a transcript", () => {
    expect(
      exchangeTranscript([
        { question: "Why?", answer: "Because.", seconds: 65 },
        { question: "And then?" },
      ]),
    ).toBe("Interviewer: Why?\nCandidate [spoke for 1 min 5 sec]: Because.\nInterviewer (follow-up): And then?");
  });
});

describe("parseItems", () => {
  it("reads saved items defensively", () => {
    const items = parseItems([
      {
        question: "Q?",
        theme: "impact",
        reason: "weird",
        turns: [{ question: "Q?", answer: "A", seconds: 30 }, { nope: 1 }],
        feedback: { summary: "ok", timing: { seconds: 30 }, newFacts: [{ fact: "f", quote: "q", kept: true }] },
      },
      { theme: "impact" },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      reason: "gap",
      turns: [{ question: "Q?", answer: "A", seconds: 30 }],
      feedback: { summary: "ok", closeness: "no_story", newFacts: [{ kept: true }] },
    });
    expect(parseItems("nope")).toEqual([]);
  });
});

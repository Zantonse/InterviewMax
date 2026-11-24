import { describe, expect, it } from "vitest";
import { onlyStarters, wantsOwnAnswer } from "./content";
import { answersTranscript, parseProbe } from "./prompts";
import { STORY_TYPES } from "./story-types";

const OPTIONS = [
  "The ask was to run a workshop",
  "Coach them on using AI",
  "Unblock a customer stakeholder",
  "Help shape the deal strategy",
];

describe("onlyStarters", () => {
  it("is true for tapped starters with nothing added (Craig, Nov 22)", () => {
    const answer = "Coach them on using AI.\nThe ask was to run a workshop.\nUnblock a customer stakeholder.";
    expect(onlyStarters(answer, OPTIONS)).toBe(true);
  });

  it("is false once the user finishes the thought", () => {
    expect(
      onlyStarters(
        "Coach them on using AI. A rep had a renewal stalled, so I built them a prep agent in an afternoon.",
        OPTIONS,
      ),
    ).toBe(false);
  });

  it("is false with no options or no tapped starter", () => {
    expect(onlyStarters("Coach them", undefined)).toBe(false);
    expect(onlyStarters("I ran it", OPTIONS)).toBe(false);
  });
});

describe("wantsOwnAnswer", () => {
  it("is true for questions that want a moment, a reason or a number", () => {
    expect(
      wantsOwnAnswer(
        "Think of the last time a rep pulled you in for your AI or niche industry knowledge — what was the situation, and what did you do?",
      ),
    ).toBe(true);
    expect(wantsOwnAnswer("Roughly how many SEs use it now?")).toBe(true);
    expect(wantsOwnAnswer("Why did you move into sales engineering?")).toBe(true);
  });

  it("is false for a kind of thing", () => {
    expect(wantsOwnAnswer("What kind of company do you want next?")).toBe(false);
  });
});

describe("parseProbe drops options on example questions", () => {
  it("keeps options only for a kind of thing", () => {
    const text = JSON.stringify({
      followUps: [
        {
          question: "Think of the last time a rep pulled you in. What did you do?",
          gap: "strengths",
          options: OPTIONS,
        },
        { question: "What kind of company do you want next?", gap: "next", options: ["A startup", "A big company"] },
      ],
    });
    const [example, kind] = parseProbe(text, 1);
    expect(example.options).toBeUndefined();
    expect(kind.options).toEqual(["A startup", "A big company"]);
  });
});

describe("answersTranscript", () => {
  it("marks an answer that is only tapped starters", () => {
    const aboutMe = STORY_TYPES.find((t) => t.id === "about_me");
    const transcript = answersTranscript(
      {
        version: 1,
        answers: {},
        followUps: [
          { question: "What did you do?", gap: "strengths", options: OPTIONS, answer: "Coach them on using AI." },
        ],
      } as never,
      aboutMe,
    );
    expect(transcript).toContain("tap-on starters I picked without adding detail");
  });
});

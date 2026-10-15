import { describe, expect, it } from "vitest";
import { parseContent } from "@/lib/stories/content";
import { untracedNumbers } from "@/lib/stories/numbers";
import { TOUGH_SYSTEM, parseToughReply, toughMessages } from "./prompts";
import {
  TOUGH_LENGTH,
  TOUGH_QUESTIONS,
  checkAnswer,
  getToughQuestion,
  isToughType,
  missingPrompts,
  speakingSeconds,
  storyHref,
  toughStoryType,
  wordCount,
} from "./questions";

const leaving = getToughQuestion("why_leaving")!;

describe("tough questions", () => {
  it("covers the seven questions in the PRD, each with prompts", () => {
    expect(TOUGH_QUESTIONS.map((q) => q.id)).toEqual([
      "why_leaving",
      "gap",
      "let_go",
      "many_moves",
      "weakness",
      "failure",
      "salary",
    ]);
    for (const q of TOUGH_QUESTIONS) expect(q.prompts.length).toBeGreaterThanOrEqual(3);
  });

  it("stores answers as their own story type and opens them on the coach page", () => {
    expect(toughStoryType("gap")).toBe("tough_gap");
    expect(isToughType("tough_gap")).toBe(true);
    expect(isToughType("went_wrong")).toBe(false);
    expect(isToughType(null)).toBe(false);
    expect(getToughQuestion("tough_salary")?.id).toBe("salary");
    expect(getToughQuestion("about_me")).toBeUndefined();
    expect(storyHref({ id: "a", storyType: "tough_gap" })).toBe("/tough-questions/a");
    expect(storyHref({ id: "b", storyType: "major_project" })).toBe("/stories/b");
  });

  it("needs every prompt not marked optional", () => {
    expect(missingPrompts(leaving, {})).toEqual(["status", "reason", "want"]);
    expect(missingPrompts(leaving, { status: "Still there", reason: "No growth", want: "Lead" }))
      .toEqual([]);
    // Salary can be answered without a number.
    expect(missingPrompts(getToughQuestion("salary")!, { first: "Ask theirs first" })).toEqual([]);
  });

  it("times an answer at about 150 words a minute", () => {
    const text = Array(75).fill("word").join(" ");
    expect(wordCount(text)).toBe(75);
    expect(speakingSeconds(text)).toBe(30);
    expect(wordCount("  ")).toBe(0);
  });
});

describe("checks on the written answer", () => {
  it("flags numbers the user never gave", () => {
    const answers = "I was there 3 years. About 40 people were cut.";
    expect(untracedNumbers("After 3 years, I was one of 40 people cut.", answers)).toEqual([]);
    const answer = "After 3 years, I was one of 200 people cut.";
    const problems = checkAnswer({ answer, untracedNumbers: untracedNumbers(answer, answers) });
    expect(problems.join(" ")).toContain("200");
  });

  it("flags an answer too long to say in about 40 seconds", () => {
    const answer = Array(TOUGH_LENGTH.max + 10).fill("word").join(" ");
    expect(checkAnswer({ answer, untracedNumbers: [] })[0]).toContain("Cut it");
    expect(checkAnswer({ answer: "Short and true.", untracedNumbers: [] })).toEqual([]);
  });
});

describe("the writer's prompt", () => {
  it("holds the honesty and no-invented-facts rules", () => {
    expect(TOUGH_SYSTEM).toContain("Use only facts the user gave");
    expect(TOUGH_SYSTEM).toContain("Never suggest hiding, misstating or dodging a fact");
    expect(TOUGH_SYSTEM).toContain("Don't call a firing a layoff");
    expect(TOUGH_SYSTEM).toContain("Never criticise a former employer");
    expect(TOUGH_SYSTEM).toContain("Never suggest a number they didn't give");
    expect(TOUGH_SYSTEM).toContain(`Never more than ${TOUGH_LENGTH.max} words`);
  });

  it("sends the question, the job and every prompt, marking skipped ones", () => {
    const [message] = toughMessages({
      question: leaving,
      answers: { status: "Still there", reason: "Reorg", want: "Own a product" },
      job: { title: "Senior PM", company: "Acme", description: "Lead our payments roadmap." },
    });
    expect(message.content).toContain('"Why are you leaving?"');
    expect(message.content).toContain("Senior PM at Acme");
    expect(message.content).toContain("Lead our payments roadmap.");
    expect(message.content).toContain("A: Reorg");
    expect(message.content).toContain("A: (skipped)");
    expect(message.content).not.toContain("needs fixing");
  });

  it("names the problem on a retry", () => {
    const [message] = toughMessages({
      question: leaving,
      answers: {},
      job: null,
      fix: "It is 140 words.",
    });
    expect(message.content).toContain("No specific role is given");
    expect(message.content).toContain("Your last answer needs fixing: It is 140 words.");
  });

  it("reads the reply, fenced or not", () => {
    expect(parseToughReply('```json\n{"answer": " I left. ", "note": "Keep it calm."}\n```')).toEqual(
      { answer: "I left.", note: "Keep it calm." },
    );
    expect(parseToughReply('{"answer": "I left."}')).toEqual({ answer: "I left.", note: "" });
    expect(() => parseToughReply('{"answer": ""}')).toThrow();
    expect(() => parseToughReply("no json")).toThrow();
  });
});

describe("saved content", () => {
  it("keeps the coach's job, note and edited flag", () => {
    const content = parseContent({
      answers: { status: "Left in May" },
      tough: { jobId: "job-1", note: "Stop after the last line.", edited: true, extra: 1 },
      draft: { parts: { answer: "I left in May." }, untracedNumbers: [], model: "m", writtenAt: "t" },
    });
    expect(content.tough).toEqual({ jobId: "job-1", note: "Stop after the last line.", edited: true });
    expect(content.draft?.parts.answer).toBe("I left in May.");
    expect(parseContent({ tough: "nope" }).tough).toBeUndefined();
  });
});

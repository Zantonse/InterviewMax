import { describe, expect, it } from "vitest";
import { builderStage, emptyContent, parseContent, type StoryContent } from "./content";
import { answersTranscript, extractJson, parseProbe, parseWrite, writeMessages } from "./prompts";
import { CORE_QUESTIONS, getStoryType } from "./story-types";

function answeredContent(): StoryContent {
  const content = emptyContent();
  for (const q of CORE_QUESTIONS) content.answers[q.id] = `answer to ${q.id}`;
  return content;
}

describe("builderStage", () => {
  it("walks from the scripted questions to a draft", () => {
    const content = emptyContent();
    expect(builderStage(content)).toBe("core");

    const answered = answeredContent();
    expect(builderStage(answered)).toBe("probe");

    answered.followUps = [{ question: "How many?", gap: "result" }];
    expect(builderStage(answered)).toBe("follow_ups");

    answered.followUps[0].answer = "12";
    expect(builderStage(answered)).toBe("write");

    answered.draft = {
      parts: { situation: "s", role: "r", actions: "a", result: "12", reflection: "l" },
      untracedNumbers: [],
      model: "m",
      writtenAt: "",
    };
    expect(builderStage(answered)).toBe("drafted");
  });
});

describe("parseContent", () => {
  it("keeps known fields and drops anything else", () => {
    const content = parseContent({
      answers: { start: "hi", bogus: "x", stakes: 3 },
      followUps: [{ question: "Q?", gap: "result", answer: "A" }, { nope: true }],
      draft: { parts: { situation: "S", extra: "x" }, untracedNumbers: ["5", 6] },
    });
    expect(content.answers).toEqual({ start: "hi" });
    expect(content.followUps).toEqual([{ question: "Q?", gap: "result", answer: "A" }]);
    expect(content.draft?.parts.situation).toBe("S");
    expect(content.draft?.parts.result).toBe("");
    expect(content.draft?.untracedNumbers).toEqual(["5"]);
  });

  it("returns empty content for junk", () => {
    expect(parseContent(null)).toEqual(emptyContent());
    expect(parseContent("x")).toEqual(emptyContent());
  });
});

describe("prompts", () => {
  it("builds a transcript with the story type's opening question", () => {
    const transcript = answersTranscript(answeredContent(), getStoryType("difficult_stakeholder"));
    expect(transcript).toContain("Story type: A difficult stakeholder");
    expect(transcript).toContain("Think of a stakeholder who was hard to work with");
    expect(transcript).toContain("A: answer to lesson");
  });

  it("asks for a rewrite naming the untraced figures", () => {
    const messages = writeMessages(answeredContent(), undefined, {
      previous: '{"title":"x"}',
      untraced: ["45%", "$1M"],
    });
    expect(messages).toHaveLength(3);
    expect(messages[2].content).toContain("45%, $1M");
  });

  it("parses follow-ups from fenced JSON and caps them at three", () => {
    const text =
      'Here you go:\n```json\n{"followUps":[{"question":"A?","gap":"Result"},{"question":"B?"},{"question":"C?"},{"question":"D?"}]}\n```';
    expect(parseProbe(text)).toEqual([
      { question: "A?", gap: "result" },
      { question: "B?", gap: "" },
      { question: "C?", gap: "" },
    ]);
  });

  it("rejects unusable model output", () => {
    expect(() => parseProbe("no json")).toThrow();
    expect(() => parseProbe('{"followUps":[]}')).toThrow();
    expect(() => parseWrite('{"title":"x","parts":{}}')).toThrow();
    expect(extractJson("{broken")).toBeUndefined();
  });

  it("parses a written story", () => {
    const story = parseWrite(
      '{"title":" Saving the renewal ","parts":{"situation":"S","role":"R","actions":"A","result":"Res","reflection":"L"}}',
    );
    expect(story.title).toBe("Saving the renewal");
    expect(story.parts.result).toBe("Res");
  });
});

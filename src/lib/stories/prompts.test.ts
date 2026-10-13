import { describe, expect, it } from "vitest";
import {
  allAnswerText,
  builderStage,
  emptyContent,
  parseContent,
  type StoryContent,
} from "./content";
import {
  answersTranscript,
  extractJson,
  parseProbe,
  parseWrite,
  probeSystem,
  writeMessages,
  writeSystem,
} from "./prompts";
import {
  STORY_TYPES,
  coreQuestions,
  getStoryType,
  storyParts,
  type StoryType,
} from "./story-types";

const stakeholder = getStoryType("difficult_stakeholder");
const aboutMe = getStoryType("about_me");

function answeredContent(storyType: StoryType | undefined = stakeholder): StoryContent {
  const content = emptyContent();
  for (const q of coreQuestions(storyType)) content.answers[q.id] = `answer to ${q.id}`;
  return content;
}

describe("story types", () => {
  it("puts Tell me about yourself first, with its own questions and parts", () => {
    expect(STORY_TYPES[0].id).toBe("about_me");
    expect(aboutMe?.label).toBe("Tell me about yourself");
    expect(coreQuestions(aboutMe).map((q) => q.id)).toEqual([
      "now",
      "path",
      "highlight",
      "known_for",
      "next",
    ]);
    const partIds = storyParts(aboutMe).map((p) => p.id);
    for (const q of coreQuestions(aboutMe)) expect(partIds).toContain(q.part);
    expect(coreQuestions(stakeholder)).toHaveLength(8);
  });
});

describe("builderStage", () => {
  it("walks from the scripted questions to a draft", () => {
    const content = emptyContent();
    expect(builderStage(content, stakeholder)).toBe("core");

    const answered = answeredContent();
    expect(builderStage(answered, stakeholder)).toBe("probe");

    answered.followUps = [{ question: "How many?", gap: "result" }];
    expect(builderStage(answered, stakeholder)).toBe("follow_ups");

    answered.followUps[0].answer = "12";
    expect(builderStage(answered, stakeholder)).toBe("write");

    answered.draft = {
      parts: {
        situation: "s",
        role: "r",
        actions: "a",
        result: "12",
        reflection: "l",
      },
      untracedNumbers: [],
      model: "m",
      writtenAt: "",
    };
    expect(builderStage(answered, stakeholder)).toBe("drafted");
  });

  it("needs only the five intro questions for Tell me about yourself", () => {
    const answered = answeredContent(aboutMe);
    expect(Object.keys(answered.answers)).toHaveLength(5);
    expect(builderStage(answered, aboutMe)).toBe("probe");
    expect(builderStage(answered, stakeholder)).toBe("core");
  });
});

describe("parseContent", () => {
  it("keeps string answers and parts and drops anything else", () => {
    const content = parseContent({
      answers: { start: "hi", bogus: "x", stakes: 3 },
      followUps: [{ question: "Q?", gap: "result", answer: "A" }, { nope: true }],
      draft: {
        parts: { situation: "S", extra: "x" },
        untracedNumbers: ["5", 6],
      },
    });
    expect(content.answers).toEqual({ start: "hi", bogus: "x" });
    expect(content.followUps).toEqual([{ question: "Q?", gap: "result", answer: "A" }]);
    expect(content.draft?.parts.situation).toBe("S");
    expect(content.draft?.parts.result).toBeUndefined();
    expect(content.draft?.untracedNumbers).toEqual(["5"]);
  });

  it("returns empty content for junk", () => {
    expect(parseContent(null)).toEqual(emptyContent());
    expect(parseContent("x")).toEqual(emptyContent());
  });
});

describe("prompts", () => {
  it("builds a transcript with the story type's opening question", () => {
    const transcript = answersTranscript(answeredContent(), stakeholder);
    expect(transcript).toContain("Story type: A difficult stakeholder");
    expect(transcript).toContain("Think of a stakeholder who was hard to work with");
    expect(transcript).toContain("A: answer to lesson");
  });

  it("uses the intro questions and prompts for Tell me about yourself", () => {
    const transcript = answersTranscript(answeredContent(aboutMe), aboutMe);
    expect(transcript).toContain("Story type: Tell me about yourself");
    expect(transcript).toContain("What's your current role");
    expect(transcript).toContain("A: answer to next");
    expect(transcript).not.toContain("answer to lesson");
    expect(probeSystem(aboutMe)).toContain("Tell me about yourself");
    expect(writeSystem(aboutMe)).toContain('"present": "…"');
    expect(writeSystem(stakeholder)).toContain('"situation": "…"');
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
    expect(() => parseWrite('{"title":"x","parts":{}}', stakeholder)).toThrow();
    expect(() => parseWrite('{"title":"x","parts":{"situation":"S"}}', aboutMe)).toThrow();
    expect(extractJson("{broken")).toBeUndefined();
  });

  it("parses a written story", () => {
    const story = parseWrite(
      '{"title":" Saving the renewal ","parts":{"situation":"S","role":"R","actions":"A","result":"Res","reflection":"L"}}',
      stakeholder,
    );
    expect(story.title).toBe("Saving the renewal");
    expect(story.parts.result).toBe("Res");
  });

  it("parses an intro by its own parts", () => {
    const story = parseWrite(
      '{"title":"T","parts":{"present":"P","path":"Pa","highlight":"H","strengths":"S","next":"N"}}',
      aboutMe,
    );
    expect(story.parts).toEqual({
      present: "P",
      path: "Pa",
      highlight: "H",
      strengths: "S",
      next: "N",
    });
  });
});

describe("uploaded answers", () => {
  it("skip the scripted questions and feed the transcript and number check", () => {
    const content = emptyContent();
    content.imported = { fileName: "intro.docx", text: "I grew revenue 40%." };
    expect(builderStage(content, aboutMe)).toBe("probe");
    expect(answersTranscript(content, aboutMe)).toContain("My prepared answer");
    expect(allAnswerText(content)).toContain("40%");
    expect(parseContent(JSON.parse(JSON.stringify(content))).imported).toEqual(content.imported);
  });
});

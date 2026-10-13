import { describe, expect, it } from "vitest";
import {
  allAnswerText,
  builderStage,
  canProbeAgain,
  emptyContent,
  probeRounds,
  parseContent,
  type StoryContent,
} from "./content";
import {
  answersTranscript,
  extractJson,
  parsePrefill,
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
    // A second round is due once the first follow-ups are answered.
    expect(builderStage(answered, stakeholder)).toBe("probe");
    expect(canProbeAgain(answered)).toBe(true);

    answered.followUps.push({ question: "Out of how many?", gap: "result", round: 2 });
    expect(probeRounds(answered)).toBe(2);
    expect(builderStage(answered, stakeholder)).toBe("follow_ups");

    answered.followUps[1].answer = "40";
    answered.probeDone = true;
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

  it("parses follow-ups from fenced JSON and caps them per round", () => {
    const six = Array.from({ length: 6 }, (_, i) => `{"question":"Q${i}?","gap":"Result"}`);
    const text = `Here you go:\n\`\`\`json\n{"followUps":[${six.join(",")}]}\n\`\`\``;
    const first = parseProbe(text, 1);
    expect(first).toHaveLength(5);
    expect(first[0]).toEqual({ question: "Q0?", gap: "result", round: 1 });
    expect(parseProbe(text, 2)).toHaveLength(3);
  });

  it("lets a later round say the answer is strong enough", () => {
    expect(parseProbe('{"followUps":[]}', 2)).toEqual([]);
    expect(() => parseProbe('{"followUps":[]}', 1)).toThrow();
  });

  it("tells the review which round it is and to push for numbers", () => {
    expect(probeSystem(aboutMe, 1)).toContain("Ask 3 to 5 questions");
    expect(probeSystem(aboutMe, 2)).toContain("return an empty list");
    expect(probeSystem(stakeholder)).toContain("Push for numbers");
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

describe("LinkedIn profile", () => {
  it("keeps only known, non-empty prefilled answers", () => {
    expect(
      parsePrefill('{"answers":{"now":" I run SE for the west. ","next":"","bogus":"x","path":4}}'),
    ).toEqual({ now: "I run SE for the west." });
    expect(() => parsePrefill("nope")).toThrow();
  });

  it("feeds the transcript and the number check", () => {
    const content = emptyContent();
    content.linkedin = { fileName: "Profile.pdf", text: "Grew pipeline 35%.", prefilled: ["now"] };
    expect(answersTranscript(content, aboutMe)).toContain("My LinkedIn profile");
    expect(allAnswerText(content)).toContain("35%");
    expect(builderStage(content, aboutMe)).toBe("core");
    expect(parseContent(JSON.parse(JSON.stringify(content))).linkedin).toEqual(content.linkedin);
  });
});

describe("review rounds", () => {
  it("keeps a story drafted before rounds existed drafted, with a second round on offer", () => {
    const content = answeredContent(aboutMe);
    content.followUps = [{ question: "Q?", gap: "highlight", answer: "A" }];
    content.draft = { parts: { present: "P" }, untracedNumbers: [], model: "m", writtenAt: "" };
    expect(builderStage(content, aboutMe)).toBe("drafted");
    expect(probeRounds(content)).toBe(1);
    expect(canProbeAgain(content)).toBe(true);

    const saved = parseContent(
      JSON.parse(
        JSON.stringify({
          ...content,
          probeDone: true,
          followUps: [{ question: "Q?", gap: "x", round: 2 }],
        }),
      ),
    );
    expect(saved.probeDone).toBe(true);
    expect(saved.followUps?.[0].round).toBe(2);
    expect(canProbeAgain(saved)).toBe(false);
  });
});

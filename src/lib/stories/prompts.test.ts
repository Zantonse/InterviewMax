import { describe, expect, it } from "vitest";
import {
  allAnswerText,
  builderStage,
  canProbeAgain,
  canStrengthen,
  MAX_STRENGTHEN_ROUNDS,
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
  parsePath,
  parseTailor,
  parseWrite,
  probeMessages,
  probeSystem,
  retryMessages,
  tailorMessages,
  writeMessages,
  writeSystem,
} from "./prompts";
import { tailoredChecks, tailoredText } from "./tailored";
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
    expect(probeSystem(aboutMe, 1)).toContain("Ask 3 or 4 questions, the lightest first");
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

  it("lets a drafted story be made stronger again and again, up to a backstop", () => {
    const content = answeredContent(aboutMe);
    expect(canStrengthen(content)).toBe(false); // nothing written yet
    content.draft = { parts: { present: "P" }, untracedNumbers: [], model: "m", writtenAt: "" };
    content.probeDone = true;
    content.followUps = [1, 2, 3].map((round) => ({
      question: "Q?",
      gap: "x",
      answer: "A",
      round,
    }));
    expect(canStrengthen(content)).toBe(true);
    content.followUps.push({ question: "Q?", gap: "x", answer: "A", round: MAX_STRENGTHEN_ROUNDS });
    expect(canStrengthen(content)).toBe(false);
    expect(parseContent({ nothingMoreToAsk: true }).nothingMoreToAsk).toBe(true);
  });
});

describe("autobiographer, not interrogator", () => {
  it("asks light, history-based questions first and never for a list of career moves", () => {
    const system = probeSystem(aboutMe, 1);
    expect(system).toContain("autobiographer, not an interrogator");
    expect(system).toContain("under a minute");
    expect(system).toContain("Never ask for a list");
    expect(system).not.toContain("demanding");
  });

  it("asks a light path question, not for two or three career moves", () => {
    const path = coreQuestions(aboutMe).find((q) => q.id === "path");
    expect(path?.text).not.toMatch(/two or three/i);
  });

  it("gives the review the resume as background, but not the writer", () => {
    const content = answeredContent(aboutMe);
    const probe = probeMessages(content, aboutMe, undefined, "Sales engineer, TikTok, 2019-2022");
    expect(probe[0].content).toContain("My resume, for background");
    expect(probe[0].content).toContain("TikTok");
    expect(writeMessages(content, aboutMe)[0].content).not.toContain("TikTok");
  });

  it("shows an inferred path back as a question to confirm", () => {
    const content = answeredContent(aboutMe);
    content.inferredPath = { text: "SE at TikTok, then PM", source: "resume" };
    const transcript = answersTranscript(content, aboutMe);
    expect(transcript).toContain("Here's how your path reads from your resume");
    const round = parseContent(JSON.parse(JSON.stringify(content)));
    expect(round.inferredPath).toEqual(content.inferredPath);
    expect(
      parseContent({ inferredPath: { text: "x", source: "email" } }).inferredPath,
    ).toBeUndefined();
  });

  it("reads the inferred path", () => {
    expect(parsePath('{"path": " SE at TikTok\\nPM at Netflix "}')).toBe(
      "SE at TikTok\nPM at Netflix",
    );
    expect(() => parsePath("nope")).toThrow();
  });
});

describe("cut the fluff", () => {
  it("gives every writer a hard length limit and the no-hedging rules", () => {
    expect(writeSystem(aboutMe)).toContain("Never go over 225 words");
    expect(writeSystem(stakeholder)).toContain("Never go over 300 words");
    expect(writeSystem(stakeholder)).toContain("maybe 100 accounts");
  });

  it("asks the writer to cut a draft over the limit and drop untraced figures", () => {
    const [previous, ask] = retryMessages({
      previous: "{}",
      untraced: ["40%"],
      words: { count: 260, max: 225 },
    });
    expect(previous).toEqual({ role: "assistant", content: "{}" });
    expect(ask.content).toContain("40%");
    expect(ask.content).toContain("260 words");
    expect(ask.content).toContain("at most 205 words");
    expect(retryMessages({ previous: "{}", untraced: [] })[1].content).not.toContain("words");
    expect(
      retryMessages({
        previous: "{}",
        untraced: [],
        figures: { found: ["1", "2", "3", "4"], max: 3 },
      })[1].content,
    ).toContain("Keep at most 3");
  });
});

describe("Tell me about yourself for one job", () => {
  const job = {
    title: "Product Manager",
    company: "Sierra",
    description: "Own the agent platform roadmap. Work with customers.",
    focus: ["Customer-facing product sense"],
  };

  it("puts the company and why-here first, then the user's answers", () => {
    const content = answeredContent(aboutMe);
    const [message] = tailorMessages(content, aboutMe, job, "I want SE and PM together.");
    const text = message.content as string;
    expect(text.indexOf("Sierra")).toBeLessThan(text.indexOf("My answers about my career"));
    expect(text).toContain("Why I want to work at Sierra");
    expect(text).toContain("I want SE and PM together.");
    expect(text).toContain("Customer-facing product sense");
  });

  it("reads the three beats and the angle", () => {
    const parsed = parseTailor(
      '{"angle":"Led with SE plus PM.","parts":{"who":"I build sales products.","proof":"Took activation from 6 weeks to instant.","why_here":"Sierra needs both."}}',
    );
    expect(parsed.angle).toBe("Led with SE plus PM.");
    expect(tailoredText(parsed.parts).split("\n\n")).toHaveLength(3);
    expect(() => parseTailor('{"parts":{}}')).toThrow();
  });

  it("checks length, numbers and hedges like any story", () => {
    const checks = tailoredChecks({
      parts: {
        who: "I build sales products.",
        proof: "It reached maybe 100 accounts.",
        why_here: "Sierra.",
      },
      angle: "",
      untracedNumbers: [],
      model: "test",
      writtenAt: "",
    });
    expect(checks.find((c) => c.id === "length")?.pass).toBe(false);
    expect(checks.find((c) => c.id === "hedged")?.pass).toBe(false);
    expect(checks.find((c) => c.id === "number")?.pass).toBe(true);
  });

  it("keeps a version per job in the story", () => {
    const content = parseContent({
      answers: {},
      tailored: {
        job1: {
          whyCompany: "Because.",
          draft: {
            parts: { who: "W" },
            angle: "A",
            untracedNumbers: [],
            model: "m",
            writtenAt: "t",
          },
        },
        job2: { whyCompany: "Only the reason so far." },
        bad: { draft: {} },
      },
    });
    expect(Object.keys(content.tailored ?? {})).toEqual(["job1", "job2"]);
    expect(content.tailored?.job1.draft?.parts.who).toBe("W");
    expect(content.tailored?.job2.draft).toBeUndefined();
  });
});

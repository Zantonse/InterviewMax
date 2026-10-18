import { describe, expect, it } from "vitest";
import {
  allAnswerText,
  builderStage,
  canProbeAgain,
  canStrengthen,
  isRoughDraft,
  MAX_STRENGTHEN_ROUNDS,
  nextFollowUpIndex,
  pendingFollowUps,
  writesRoughDraft,
  emptyContent,
  maxProbeRounds,
  skipRemainingFollowUps,
  probeRounds,
  parseContent,
  isUntouched,
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
  coreQuestionText,
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
    // A behavioral story opens with one "tell it your way" question.
    expect(coreQuestions(stakeholder).map((q) => q.id)).toEqual(["start"]);
    expect(coreQuestionText("start", stakeholder)).toMatch(/^Tell me about a stakeholder/);
    for (const type of STORY_TYPES.filter((t) => t.format === "star")) {
      expect(type.joggers.length).toBeGreaterThanOrEqual(3);
    }
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
    // One round of follow-ups, then it's written.
    expect(canProbeAgain(answered)).toBe(false);
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

describe("the AI-use story", () => {
  const aiUse = getStoryType("ai_use");

  it("asks what they had the AI do and what they checked and changed", () => {
    expect(coreQuestionText("start", aiUse)).toMatch(/what you checked or changed/);
    expect(probeSystem(aiUse)).toMatch(/what they checked in its output/);
    expect(probeSystem(aiUse)).toMatch(/the call they made themselves/);
    expect(writeSystem(aiUse)).toMatch(/never make the AI sound like it did more/);
    expect(probeSystem(stakeholder)).not.toMatch(/using AI at work/);
    expect(writeSystem(stakeholder)).not.toMatch(/using AI at work/);
  });
});

describe("show your thinking", () => {
  it("asks how they thought at the key moment, and has the review and writer draw it out", () => {
    expect(coreQuestionText("choice", stakeholder)).toMatch(/What were you thinking at the key moment/);
    expect(coreQuestionText("choice", stakeholder)).toMatch(/what did you watch/);
    expect(probeSystem(stakeholder)).toMatch(/options they weighed, why they chose one/);
    expect(writeSystem(stakeholder)).toMatch(/show their thinking/);
    expect(writeSystem(stakeholder)).toMatch(/Use only reasoning they gave; never invent it/);
  });
});

describe("prompts", () => {
  it("builds a transcript with the story type's opening question", () => {
    const transcript = answersTranscript(answeredContent(), stakeholder);
    expect(transcript).toContain("Story type: A difficult stakeholder");
    expect(transcript).toContain("Tell me about a stakeholder who was hard to work with");
    expect(transcript).toContain("A: answer to start");
  });

  it("still reads answers to the old scripted questions", () => {
    const content = answeredContent();
    content.answers.lesson = "Ask earlier";
    const transcript = answersTranscript(content, stakeholder);
    expect(transcript).toContain("What did you learn, and what would you do differently");
    expect(transcript).toContain("A: Ask earlier");
  });

  it("tells the coach about questions the user passed on", () => {
    const content = answeredContent();
    content.followUps = [{ question: "How many users?", gap: "result", round: 1, skipped: true }];
    expect(answersTranscript(content, stakeholder)).toContain("I don't know this one");
    expect(allAnswerText(content)).not.toContain("I don't know");
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
  it("keeps a story drafted before rounds existed drafted", () => {
    const content = answeredContent(aboutMe);
    content.followUps = [{ question: "Q?", gap: "highlight", answer: "A" }];
    content.draft = { parts: { present: "P" }, untracedNumbers: [], model: "m", writtenAt: "" };
    expect(builderStage(content, aboutMe)).toBe("drafted");
    expect(probeRounds(content)).toBe(1);
    expect(canProbeAgain(content)).toBe(false);

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

  it("gives the About me writer the target jobs to hint at, but not a behavioral story's", () => {
    const targets = {
      jobs: [
        {
          title: "Data governance lead",
          company: "Commerce Bank",
          level: "senior",
          focus: ["Driving adoption without authority"],
          questions: [],
        },
      ],
    };
    const intro = writeMessages(answeredContent(aboutMe), aboutMe, undefined, [], targets);
    expect(intro[0].content).toContain("Driving adoption without authority");
    const story = writeMessages(answeredContent(), stakeholder, undefined, [], targets);
    expect(story[0].content).not.toContain("Driving adoption without authority");
    expect(writeSystem(aboutMe)).toMatch(/most recent role/);
    expect(writeSystem(stakeholder)).toMatch(/Keep the user's own words/);
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
    expect(parsed.companyClose).toBe("");
  });

  it("reads the bolder company closing as an alternative, outside the script", () => {
    const parsed = parseTailor(
      '{"angle":"","parts":{"who":"I build sales products.","proof":"Took activation from 6 weeks to instant.","why_here":"That mix is what draws me to this role."},"companyClose":"Your agent launch is the kind of work I want next."}',
    );
    expect(parsed.companyClose).toBe("Your agent launch is the kind of work I want next.");
    expect(tailoredText(parsed.parts)).not.toContain("agent launch");
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

describe("shorter About me and skipping follow-ups", () => {
  it("gives every story one follow-up round before the draft is final", () => {
    expect(maxProbeRounds()).toBe(1);
  });

  it("drops unanswered follow-ups and goes on to writing", () => {
    const content = answeredContent(aboutMe);
    content.followUps = [
      { question: "Q1?", gap: "highlight", answer: "A1", round: 1 },
      { question: "Q2?", gap: "strengths", round: 1 },
      { question: "Q3?", gap: "next", answer: "  ", round: 1 },
    ];
    expect(builderStage(content, aboutMe)).toBe("follow_ups");
    const skipped = skipRemainingFollowUps(content);
    expect(skipped.followUps?.map((f) => f.question)).toEqual(["Q1?"]);
    expect(skipped.probeDone).toBe(true);
    expect(builderStage(skipped, aboutMe)).toBe("write");
  });

  it("keeps a drafted story drafted when its extra questions are skipped", () => {
    const content = answeredContent(aboutMe);
    content.draft = { parts: { present: "P" }, untracedNumbers: [], model: "m", writtenAt: "" };
    content.followUps = [{ question: "More?", gap: "highlight", round: 2 }];
    expect(builderStage(content, aboutMe)).toBe("follow_ups");
    expect(builderStage(skipRemainingFollowUps(content), aboutMe)).toBe("drafted");
  });
});

describe("tell it your way", () => {
  it("writes a rough draft of a behavioral story straight after the telling", () => {
    const content = answeredContent();
    expect(writesRoughDraft(content, stakeholder)).toBe(true);
    // About me keeps asking its follow-ups before writing.
    expect(writesRoughDraft(answeredContent(aboutMe), aboutMe)).toBe(false);

    content.draft = { parts: { situation: "S" }, untracedNumbers: [], model: "m", writtenAt: "" };
    expect(writesRoughDraft(content, stakeholder)).toBe(false);
    // Then the follow-ups are asked about it.
    expect(builderStage(content, stakeholder)).toBe("probe");

    content.followUps = [
      { question: "What was at stake?", gap: "situation", round: 1 },
      { question: "How many?", gap: "result", round: 1 },
    ];
    expect(builderStage(content, stakeholder)).toBe("follow_ups");
    expect(isRoughDraft(content)).toBe(true);

    content.followUps[0].answer = "The renewal";
    content.followUps[1].skipped = true;
    expect(pendingFollowUps(content)).toBe(0);
    expect(nextFollowUpIndex(content)).toBeUndefined();
    expect(isRoughDraft(content)).toBe(false);
    expect(builderStage(content, stakeholder)).toBe("drafted");
    expect(parseContent(JSON.parse(JSON.stringify(content))).followUps?.[1].skipped).toBe(true);
  });

  it("asks only about what the telling left out, and always about their thinking", () => {
    const system = probeSystem(stakeholder, 1);
    expect(system).toMatch(/in their own words/);
    expect(system).toMatch(/Ask 2 to 5 questions, only about what the telling doesn't already cover/);
    expect(system).toMatch(/one of your questions must ask about it/);
    expect(probeSystem(aboutMe, 1)).toMatch(/Ask 3 or 4 questions/);
  });
});

describe("tap options on follow-ups", () => {
  it("keeps 2 to 4 short starters and drops any with a number", () => {
    const [ownership, result] = parseProbe(
      JSON.stringify({
        followUps: [
          {
            question: "What was your part?",
            gap: "ownership",
            options: ["I led it.", "I did the hands-on work", "One of a few", "I advised", "Other"],
          },
          { question: "How many users?", gap: "result", options: ["About 50", "Hundreds"] },
        ],
      }),
    );
    expect(ownership.options).toEqual([
      "I led it",
      "I did the hands-on work",
      "One of a few",
      "I advised",
    ]);
    // One option left after dropping the figure isn't a choice, so none are kept.
    expect(result.options).toBeUndefined();
  });

  it("asks the coach for options on kind-of-thing questions only, and keeps them when saved", () => {
    expect(probeSystem(stakeholder, 1)).toMatch(/Tap options/);
    expect(probeSystem(aboutMe, 1)).toMatch(/Never put a number, a name, or a fact/);
    const content = answeredContent();
    content.followUps = [
      { question: "What was at stake?", gap: "situation", round: 1, options: ["A deal", "A deadline"] },
    ];
    const saved = parseContent(JSON.parse(JSON.stringify(content)));
    expect(saved.followUps?.[0].options).toEqual(["A deal", "A deadline"]);
  });
});

describe("deeper pass: edit, don't rewrite, and what made it hard", () => {
  it("has the writer edit the user's telling instead of rewriting it", () => {
    expect(writeSystem(stakeholder)).toMatch(/editor, not a ghostwriter/);
    expect(writeSystem(aboutMe)).toMatch(/editor, not a ghostwriter/);
  });

  it("asks about the obstacle when the telling has none, and writes it into the actions", () => {
    expect(probeSystem(stakeholder, 1)).toMatch(/what made it hard/);
    expect(probeSystem(stakeholder, 1)).toMatch(/obstacle/);
    expect(writeSystem(stakeholder)).toMatch(/including what made it hard if they said/);
  });

  it("sends a draft that isn't in their words back to be reworked from their answers", () => {
    const [, ask] = retryMessages({ previous: "{}", untraced: [], ownWords: { share: 0.12, min: 0.25 } });
    expect(ask.content).toMatch(/Only 12% of it uses my own phrasing/);
    expect(ask.content).toMatch(/keep my sentences and phrases/);
  });
});

describe("a story started from an interview question", () => {
  it("keeps the question and opens with it", async () => {
    const { coreQuestionText, getStoryType } = await import("./story-types");
    const content = parseContent({ answers: {}, asked: "  Tell me about a time you failed  " });
    expect(content.asked).toBe("Tell me about a time you failed");
    const opening = coreQuestionText("start", getStoryType("went_wrong"), content.asked);
    expect(opening.startsWith("Tell me about a time you failed. Tell it start to finish")).toBe(true);
    expect(coreQuestionText("start", getStoryType("went_wrong"))).toBe(
      getStoryType("went_wrong")?.opening,
    );
  });

  it("counts as untouched until the user adds something", () => {
    expect(isUntouched({ ...emptyContent(), asked: "Q?" })).toBe(true);
    expect(isUntouched({ ...emptyContent(), answers: { start: "  " } })).toBe(true);
    expect(isUntouched({ ...emptyContent(), answers: { start: "We lost a deal." } })).toBe(false);
  });
});

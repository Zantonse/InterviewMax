import { describe, expect, it } from "vitest";
import { coverageFor, questionsToBuild } from "@/lib/questions/coverage";
import { emptyContent, parseContent, type StoryContent } from "@/lib/stories/content";
import { AI_STEP_USES } from "@/lib/privacy/ai-steps";
import {
  MAX_PICKS,
  alsoAnswerFor,
  alsoAnswersAreCurrent,
  candidatePool,
  orderPicks,
  parseAlsoAnswers,
  sourceLabels,
  type AlsoAnswer,
  type StoryAlsoAnswers,
} from "./content";
import { QUESTIONS_SYSTEM, parseQuestionsReply, questionsMessages } from "./prompts";

const job = {
  id: "j1",
  title: "Senior PM",
  company: "Acme",
  likelyQuestions: {
    questions: [
      { question: "Tell me about yourself.", theme: "about_you" as const },
      { question: "Tell me about a time you disagreed with your manager.", theme: "conflict" as const },
      { question: "Tell me about a time you failed.", theme: "failure" as const },
    ],
  },
};

function written(also?: StoryAlsoAnswers, writtenAt = "2026-11-05T00:00:00Z"): StoryContent {
  return {
    ...emptyContent(),
    draft: { parts: { situation: "We were late." }, untracedNumbers: [], model: "m", writtenAt },
    ...(also ? { alsoAnswers: also } : {}),
  };
}

function pick(question: string, fit: "strong" | "angle" = "strong"): AlsoAnswer {
  return { question, theme: "conflict", sources: [{ kind: "library" }], fit, emphasize: "Lead with the call." };
}

describe("candidatePool", () => {
  it("puts the user's own questions first, merges repeats and skips the built-for and intro questions", () => {
    const pool = candidatePool({
      jobs: [job],
      interviews: [
        { id: "t1", title: "Acme screen", asked: [{ question: "Tell me about a time you failed!", theme: "failure" }] },
      ],
      bank: [{ question: "Why this team?", theme: "about_you", label: "Asked at Acme, Oct 2026" }],
      asked: "Tell me about a time you disagreed with your manager",
    });
    expect(pool[0].question).toBe("Tell me about a time you failed.");
    expect(pool[0].sources.map((s) => s.kind)).toEqual(["job", "interview", "library"]);
    expect(pool.some((c) => c.question.startsWith("Tell me about yourself"))).toBe(false);
    expect(pool.some((c) => c.question === "Why this team?")).toBe(false);
    expect(pool.some((c) => /disagreed with your manager/.test(c.question))).toBe(false);
    // Story-shaped tough questions go in; situation ones (salary) don't.
    expect(pool.some((c) => c.question === "What's your greatest weakness?")).toBe(true);
    expect(pool.some((c) => /salary/i.test(c.question))).toBe(false);
    // The library fills the rest.
    expect(pool.some((c) => c.sources[0].kind === "library")).toBe(true);
  });

  it("stops at the cap", () => {
    expect(candidatePool({ jobs: [job], max: 2 })).toHaveLength(2);
  });
});

describe("sourceLabels", () => {
  it("names jobs, past interviews, the bank, tough questions, and the library only on its own", () => {
    expect(
      sourceLabels([
        { kind: "job", jobId: "a", label: "Acme" },
        { kind: "job", jobId: "b", label: "Globex" },
        { kind: "interview", transcriptId: "t", label: "x" },
        { kind: "library" },
      ]),
    ).toEqual(["Likely at Acme and Globex", "Asked you before"]);
    expect(sourceLabels([{ kind: "library" }])).toEqual(["Common question"]);
    expect(sourceLabels([{ kind: "tough", toughId: "weakness" }])).toEqual(["Tough question"]);
  });
});

describe("parseQuestionsReply", () => {
  const candidates = candidatePool({ jobs: [job], max: 5 });

  it("maps numbers back to the candidates, drops bad picks and puts fits-as-told first", () => {
    const reply = JSON.stringify({
      picks: [
        { n: 2, fit: "angle", emphasize: "Open with the lesson." },
        { n: 1, fit: "strong", emphasize: "Open with the disagreement." },
        { n: 1, fit: "strong", emphasize: "Repeat." },
        { n: 99, fit: "strong", emphasize: "Not on the list." },
        { n: 3, fit: "strong", emphasize: "" },
        { n: "4", fit: "weird", emphasize: "String number, unknown fit." },
      ],
    });
    const picks = parseQuestionsReply(`Here you go: ${reply}`, candidates);
    expect(picks.map((p) => p.question)).toEqual([
      candidates[0].question,
      candidates[1].question,
      candidates[3].question,
    ]);
    expect(picks[0]).toMatchObject({ fit: "strong", emphasize: "Open with the disagreement." });
    expect(picks[2].fit).toBe("angle");
  });

  it("keeps at most MAX_PICKS and throws on an empty reply", () => {
    const many = candidatePool({ jobs: [job] });
    const reply = JSON.stringify({ picks: many.map((_, i) => ({ n: i + 1, fit: "strong", emphasize: "x" })) });
    expect(parseQuestionsReply(reply, many)).toHaveLength(MAX_PICKS);
    expect(() => parseQuestionsReply("no json", many)).toThrow();
  });

  it("numbers the list and asks for JSON picks only", () => {
    const [msg] = questionsMessages({ title: "T", story: "S", asked: "Q?", candidates });
    expect(msg.content).toContain(`1. ${candidates[0].question}`);
    expect(msg.content).toContain("[target job or past interview]");
    expect(msg.content).toContain('It was written to answer: "Q?"');
    expect(QUESTIONS_SYSTEM).toContain('"picks"');
  });
});

describe("orderPicks", () => {
  it("puts the user's own questions ahead of the library within a fit", () => {
    const lib = pick("Library one");
    const mine = { ...pick("Mine"), sources: [{ kind: "job" as const, jobId: "j", label: "Acme" }] };
    expect(orderPicks([lib, mine]).map((p) => p.question)).toEqual(["Mine", "Library one"]);
  });
});

describe("stored picks", () => {
  const also: StoryAlsoAnswers = {
    questions: [pick("Tell me about a time you pushed back on a request.")],
    model: "m",
    draftWrittenAt: "2026-11-05T00:00:00Z",
    checkedAt: "2026-11-05T00:01:00Z",
  };

  it("survive parseContent and go stale when the draft changes", () => {
    const content = parseContent(JSON.parse(JSON.stringify(written(also))));
    expect(content.alsoAnswers).toEqual(also);
    expect(alsoAnswersAreCurrent(content.alsoAnswers, content.draft?.writtenAt)).toBe(true);
    expect(alsoAnswersAreCurrent(also, "2026-11-06T00:00:00Z")).toBe(false);
    expect(alsoAnswerFor(written(also), "tell me about a time you pushed back on a request")).toBeDefined();
    expect(alsoAnswerFor(written(also, "later"), "Tell me about a time you pushed back on a request.")).toBeUndefined();
  });

  it("drop picks without a question or emphasis line", () => {
    const parsed = parseAlsoAnswers({ questions: [{ question: "Q" }, { question: "R", emphasize: "E" }] });
    expect(parsed?.questions).toEqual([
      { question: "R", theme: null, sources: [{ kind: "library" }], fit: "angle", emphasize: "E" },
    ]);
  });
});

describe("coverage from Also answers", () => {
  const question = "Tell me about a time you disagreed with your manager.";
  const also: StoryAlsoAnswers = {
    questions: [pick(question)],
    model: "m",
    draftWrittenAt: "2026-11-05T00:00:00Z",
    checkedAt: "",
  };
  const story = { id: "s1", title: "Launch date", storyType: "major_project", content: written(also) };

  it("covers a question with no story of its type, with what to lead with", () => {
    expect(coverageFor("conflict", [story], question)).toEqual({
      kind: "story",
      storyId: "s1",
      title: "Launch date",
      drafted: true,
      emphasize: "Lead with the call.",
    });
    // Without the question, or once the story changes, it's back to the theme.
    expect(coverageFor("conflict", [story])).toMatchObject({ kind: "build" });
    const stale = { ...story, content: written(also, "later") };
    expect(coverageFor("conflict", [stale], question)).toMatchObject({ kind: "build" });
  });

  it("never replaces a written story of the theme's own type", () => {
    const own = { id: "s2", title: "The VP", storyType: "difficult_stakeholder", content: written() };
    expect(coverageFor("conflict", [story, own], question)).toMatchObject({ storyId: "s2" });
  });

  it("takes covered questions out of the story picker", () => {
    const jobs = [{ ...job, interviewDate: null }];
    expect(questionsToBuild(jobs, []).map((q) => q.question)).toContain(question);
    expect(questionsToBuild(jobs, [story]).map((q) => q.question)).not.toContain(question);
  });
});

describe("privacy", () => {
  it("lists the step on the AI usage page", () => {
    expect(AI_STEP_USES.storyQuestions.feature).toMatch(/Also answers/);
  });
});

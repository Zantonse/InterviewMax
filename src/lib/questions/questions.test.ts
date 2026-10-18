import { describe, expect, it } from "vitest";
import { emptyContent, type StoryContent } from "@/lib/stories/content";
import { STORY_TYPES } from "@/lib/stories/story-types";
import {
  MAX_QUESTIONS,
  type LikelyQuestion,
  parseLikelyQuestions,
  parseQuestionList,
  withAiUseQuestion,
} from "./content";
import { coverageFor } from "./coverage";
import {
  LIKELY_QUESTIONS_SYSTEM,
  likelyQuestionsMessages,
  parseLikelyQuestionsReply,
} from "./prompts";
import { QUESTION_THEMES } from "./themes";

function drafted(): StoryContent {
  return {
    ...emptyContent(),
    // An uploaded answer skips the scripted questions.
    imported: { fileName: "a.txt", text: "answer" },
    followUps: [],
    draft: { parts: {}, untracedNumbers: [], model: "m", writtenAt: "" },
  };
}

describe("the AI-use question", () => {
  const q = (n: number, theme: LikelyQuestion["theme"] = "impact"): LikelyQuestion => ({
    question: `Question ${n}?`,
    theme,
    why: "",
    source: "common",
    specific: false,
  });

  it("goes in fourth when no question covers it, keeping the list at the limit", () => {
    const full = Array.from({ length: MAX_QUESTIONS }, (_, i) => q(i));
    const withAi = withAiUseQuestion(full);
    expect(withAi).toHaveLength(MAX_QUESTIONS);
    expect(withAi[3]).toMatchObject({ theme: "ai_use", source: "common" });
    expect(withAi.at(-1)?.question).toBe(`Question ${MAX_QUESTIONS - 2}?`);
  });

  it("leaves a list that already asks it alone, and an empty list empty", () => {
    const list = [q(1), q(2, "ai_use")];
    expect(withAiUseQuestion(list)).toBe(list);
    expect(withAiUseQuestion([])).toEqual([]);
  });

  it("shows up on jobs predicted before it existed", () => {
    const saved = parseLikelyQuestions({ questions: [q(1), q(2)], model: "m" });
    expect(saved?.questions.map((x) => x.theme)).toEqual(["impact", "impact", "ai_use"]);
  });
});

describe("question themes", () => {
  it("has eleven themes, each answered by a real story type", () => {
    expect(QUESTION_THEMES).toHaveLength(11);
    const typeIds = new Set<string>(STORY_TYPES.map((t) => t.id));
    for (const theme of QUESTION_THEMES) {
      expect(theme.storyTypes.length).toBeGreaterThan(0);
      for (const id of theme.storyTypes) expect(typeIds.has(id)).toBe(true);
    }
  });

  it("every story type answers at least one theme", () => {
    const covered = new Set<string>(QUESTION_THEMES.flatMap((t) => t.storyTypes));
    for (const type of STORY_TYPES) expect(covered.has(type.id)).toBe(true);
  });

  it("puts the themes and templates in the prompt", () => {
    for (const theme of QUESTION_THEMES) {
      expect(LIKELY_QUESTIONS_SYSTEM).toContain(theme.id);
      expect(LIKELY_QUESTIONS_SYSTEM).toContain(theme.templates[0]);
    }
  });
});

describe("parseQuestionList", () => {
  it("keeps known themes, drops duplicates and caps the list", () => {
    const raw = [
      { question: "Tell me about yourself.", theme: "about_you", source: "common" },
      { question: "tell me about yourself.", theme: "about_you" },
      { question: "Describe a deal you lost.", theme: "made_up" },
      { question: "  ", theme: "failure" },
      "nope",
      ...Array.from({ length: 15 }, (_, i) => ({
        question: `Q${i}`,
        theme: "impact",
        source: "weird",
        specific: "yes",
      })),
    ];
    const list = parseQuestionList(raw);
    expect(list).toHaveLength(MAX_QUESTIONS);
    expect(list[0]).toEqual({
      question: "Tell me about yourself.",
      theme: "about_you",
      why: "",
      source: "common",
      specific: false,
    });
    expect(list[1]).toMatchObject({ question: "Q0", source: "common", specific: false });
  });

  it("reads stored questions, or null when there are none", () => {
    expect(parseLikelyQuestions(null)).toBeNull();
    expect(parseLikelyQuestions({ questions: [] })).toBeNull();
    const stored = parseLikelyQuestions({
      questions: [{ question: "Why us?", theme: "about_you", why: "opener" }],
      usedReports: true,
      model: "m",
    });
    expect(stored?.questions[0].why).toBe("opener");
    expect(stored?.usedReports).toBe(true);
  });
});

describe("likely questions prompt", () => {
  const job = { title: "Finance Manager", company: "Acme", level: "senior", description: "Own the forecast." };

  it("includes other jobs, shared points and reports when given", () => {
    const [m] = likelyQuestionsMessages({
      job,
      otherJobs: [{ title: "Senior Analyst", company: null }],
      shared: ["Forecasting"],
      reports: "They asked about a missed forecast.",
    });
    expect(m.content).toContain("## The job: Finance Manager at Acme (Senior)");
    expect(m.content).toContain("- Senior Analyst");
    expect(m.content).toContain("- Forecasting");
    expect(m.content).toContain("They asked about a missed forecast.");
  });

  it("says when there's one job and no reports", () => {
    const [m] = likelyQuestionsMessages({ job, otherJobs: [], shared: [], reports: " " });
    expect(m.content).toContain("This is my only target job.");
    expect(m.content).toContain("I haven't found any interview reports.");
  });

  it("can't mark a question specific with one job, or from a report without reports", () => {
    const reply = JSON.stringify({
      questions: [{ question: "Tell me about a missed forecast.", theme: "failure", source: "report", specific: true }],
    });
    const [q] = parseLikelyQuestionsReply(reply, { hasOtherJobs: false, hasReports: false });
    expect(q.specific).toBe(false);
    expect(q.source).toBe("posting");
    const [q2] = parseLikelyQuestionsReply(reply, { hasOtherJobs: true, hasReports: true });
    expect(q2).toMatchObject({ specific: true, source: "report" });
  });

  it("throws when nothing usable comes back", () => {
    expect(() => parseLikelyQuestionsReply("sorry", { hasOtherJobs: false, hasReports: false })).toThrow();
    expect(() =>
      parseLikelyQuestionsReply('{"questions": []}', { hasOtherJobs: false, hasReports: false }),
    ).toThrow();
  });
});

describe("coverageFor", () => {
  it("prefers a written story, then any story, then names the type to build", () => {
    const inProgress = { id: "1", title: "Acme deal", storyType: "major_project", content: emptyContent() };
    const written = { id: "2", title: "Defining wins", storyType: "defining_success", content: drafted() };
    expect(coverageFor("impact", [inProgress, written])).toEqual({
      kind: "story",
      storyId: "2",
      title: "Defining wins",
      drafted: true,
    });
    expect(coverageFor("impact", [inProgress])).toMatchObject({ kind: "story", storyId: "1", drafted: false });
    expect(coverageFor("conflict", [inProgress])).toEqual({
      kind: "build",
      storyType: "difficult_stakeholder",
    });
    expect(coverageFor("nonsense", [])).toBeUndefined();
  });
});

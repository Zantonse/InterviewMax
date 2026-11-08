import { describe, expect, it } from "vitest";
import { assignModels, availableModels } from "./models";
import { PERSONAS } from "./personas";
import { metricsTable, reportMarkdown, transcriptForAnalyst } from "./report";
import { bestStory, scoreRun, type ResultPayload, type StepRecord } from "./score";

function step(n: number, over: Partial<StepRecord> = {}): StepRecord {
  return {
    step: n,
    path: "/stories/new",
    thought: "",
    action: { type: "click", id: 1 },
    summary: 'Clicked "Next"',
    appText: "",
    seconds: 2,
    noChange: false,
    errors: [],
    ...over,
  };
}

const graded = {
  id: "s1",
  title: "Handled a conflict",
  story_type: "conflict",
  tier: "good_enough",
  created_at: "2026-11-07T00:00:00Z",
  updated_at: "2026-11-07T00:10:00Z",
  content: {
    version: 1,
    asked: "Tell me about a disagreement",
    answers: { situation: "We disagreed about the vendor pilot", action: "I proposed a de-identified extract" },
    followUps: [
      { question: "What was hard?", gap: "hardest", answer: "The CIO wanted it fast" },
      { question: "Numbers?", gap: "result", skipped: true },
    ],
    draft: {
      parts: { situation: "We disagreed about the vendor pilot.", action: "I proposed a de-identified extract." },
      untracedNumbers: [],
      ownWords: 0.62,
      model: "m",
      writtenAt: "2026-11-07T00:05:00Z",
    },
    grade: {
      tier: "good_enough",
      fixes: ["Add a number"],
      strengths: [],
      criteria: [
        { id: "a", score: 3, note: "" },
        { id: "b", score: 2, note: "" },
      ],
      checks: [],
      flags: [],
      model: "g",
      draftWrittenAt: "2026-11-07T00:05:00Z",
      gradedAt: "2026-11-07T00:06:00Z",
    },
  },
};

const aboutMe = { ...graded, id: "s0", story_type: "about_me" };

const result: ResultPayload = {
  stories: [aboutMe, graded],
  jobs: [{ title: "Head of Data Governance", company: "Harborline", hasLikelyQuestions: true }],
  events: [{ event: "story_started", created_at: "" }, { event: "story_started", created_at: "" }],
  signals: [{ kind: "rage_click", path: "/", target: "button", created_at: "" }],
};

describe("bestStory", () => {
  it("picks the behavioral story and reads its numbers", () => {
    const s = bestStory(result.stories)!;
    expect(s.storyType).toBe("conflict");
    expect(s.followUpsAnswered).toBe(1);
    expect(s.followUpsSkipped).toBe(1);
    expect(s.ownWords).toBe(0.62);
    expect(s.graded).toBe(true);
    expect(s.score).toBe(63);
    expect(s.fixes).toEqual(["Add a number"]);
  });

  it("ignores About me", () => {
    expect(bestStory([aboutMe])).toBeUndefined();
  });
});

describe("scoreRun", () => {
  it("counts steps, stuck runs and errors", () => {
    const m = scoreRun({
      steps: [
        step(1),
        step(2, { noChange: true }),
        step(3, { noChange: true, errors: ["500 from /stories/new"] }),
        step(4, { seconds: 45 }),
        step(5, { action: { type: "done", reason: "finished" } }),
      ],
      result,
      startedAt: 0,
      endedAt: 6 * 60_000,
    });
    expect(m.outcome).toBe("graded");
    expect(m.steps).toBe(5);
    expect(m.minutes).toBe(6);
    expect(m.noChangeSteps).toBe(2);
    expect(m.longestStuck).toBe(2);
    expect(m.errors).toBe(1);
    expect(m.slowSteps).toBe(1);
    expect(m.jobAdded).toBe(true);
    expect(m.events.story_started).toBe(2);
    expect(m.signals.rage_click).toBe(1);
  });

  it("marks a give-up without a draft", () => {
    const m = scoreRun({
      steps: [step(1, { action: { type: "give_up", reason: "too many questions" } })],
      result: { stories: [], jobs: [], events: [], signals: [] },
      startedAt: 0,
      endedAt: 1000,
    });
    expect(m.outcome).toBe("gave_up");
    expect(m.gaveUp).toBe("too many questions");
  });

  it("marks a crashed run", () => {
    const m = scoreRun({ steps: [], result: null, startedAt: 0, endedAt: 0, crashed: "sign-in 409" });
    expect(m.outcome).toBe("error");
    expect(m.errors).toBe(1);
  });
});

describe("report", () => {
  const run = {
    persona: PERSONAS[2],
    model: "vendor/model",
    steps: [step(1, { thought: "Fine.", appText: "What happened next?" })],
    metrics: scoreRun({ steps: [step(1)], result, startedAt: 0, endedAt: 60_000 }),
  };

  it("tabulates each persona", () => {
    const table = metricsTable([run]);
    expect(table).toContain("Teresa Alvarado (data-governance)");
    expect(table).toContain("Finished and graded");
    expect(table).toContain("62%");
    expect(table).toContain("good enough, 63/100");
  });

  it("gives the analyst steps, thoughts and the draft", () => {
    const t = transcriptForAnalyst(run);
    expect(t).toContain("Thinks: Fine.");
    expect(t).toContain("App showed: What happened next?");
    expect(t).toContain("I proposed a de-identified extract.");
  });

  it("says when there are no insights", () => {
    const md = reportMarkdown({ runs: [run], insights: "", url: "https://x.vercel.app", notes: ["a note"] });
    expect(md).toContain("didn't answer");
    expect(md).toContain("- a note");
  });
});

describe("models", () => {
  it("rotates persona models by run number", () => {
    const ids = ["a", "b", "c"];
    const models = ["m1", "m2", "m3", "m4"];
    expect(assignModels(ids, 0, models)).toEqual({ a: "m1", b: "m2", c: "m3" });
    expect(assignModels(ids, 1, models)).toEqual({ a: "m2", b: "m3", c: "m4" });
    expect(assignModels(ids, 3, models)).toEqual({ a: "m4", b: "m1", c: "m2" });
  });

  it("skips models the catalog doesn't list", () => {
    expect(availableModels(["x", "y"], new Set(["y"]))).toEqual({ ok: ["y"], missing: ["x"] });
    expect(availableModels(["x"], null)).toEqual({ ok: ["x"], missing: [] });
  });
});

import { describe, expect, it } from "vitest";
import { PERSONAS } from "./personas";
import type { PersonaRun } from "./report";
import { reportMarkdown } from "./report";
import { JUDGE_DIMENSIONS, parseJudge, parseSurvey, passBars, scorecardCsv, surveyPrompt } from "./rubric";
import type { RunMetrics } from "./score";

const metrics = (over: Partial<RunMetrics> = {}): RunMetrics =>
  ({
    outcome: "graded",
    steps: 40,
    minutes: 6,
    slowSteps: 0,
    noChangeSteps: 2,
    longestStuck: 1,
    errors: 0,
    jobAdded: true,
    likelyQuestions: true,
    events: {},
    signals: {},
    story: {
      title: "T",
      storyType: "behavioral",
      answers: 3,
      followUpsAsked: 3,
      followUpsAnswered: 3,
      followUpsSkipped: 0,
      graded: true,
      tier: "strong",
      score: 80,
      fixes: ["Add a number"],
      draftText: "I did it.",
    },
    ...over,
  }) as RunMetrics;

const judgeAll = (score: number) =>
  Object.fromEntries(JUDGE_DIMENSIONS.map((d) => [d.id, { score, evidence: "step 3" }]));

const run = (i: number, over: Partial<PersonaRun> = {}): PersonaRun => ({
  persona: PERSONAS[i],
  model: "m",
  metrics: metrics(),
  steps: [],
  ...over,
});

describe("rubric", () => {
  it("asks the full survey after a draft and the short one after giving up", () => {
    expect(surveyPrompt(run(0))).toContain("q5.");
    const quit = surveyPrompt(run(0, { metrics: metrics({ outcome: "gave_up", gaveUp: "too long", story: undefined }) }));
    expect(quit).not.toContain("q5.");
    expect(quit).toContain('"stopped"');
  });

  it("reads survey and judge JSON, dropping out-of-range scores", () => {
    const s = parseSurvey('Sure: {"q1": {"score": 4, "why": "clear"}, "q2": {"score": 9, "why": "x"}}');
    expect(s?.answers.q1).toEqual({ score: 4, why: "clear" });
    expect(s?.answers.q2).toBeUndefined();
    const j = parseJudge('{"fidelity": {"score": 2, "evidence": "invented 30%"}, "voice": {"score": 5}}');
    expect(j?.fidelity?.score).toBe(2);
    expect(j?.voice).toBeUndefined();
    expect(parseJudge("no json")).toBeUndefined();
  });

  it("passes or fails each bar", () => {
    const good = { judge: judgeAll(3), survey: { answers: { q1: { score: 4, why: "" }, q6: { score: 4, why: "" } } } };
    const bars = passBars([run(0, good), run(1, good), run(2, good)]);
    expect(bars.map((b) => b.pass)).toEqual([true, true, true, true, true]);

    const blocked = passBars([
      run(0, { ...good, judge: { ...judgeAll(3), fidelity: { score: 1, evidence: "made up" } } }),
      run(1, { ...good, metrics: metrics({ outcome: "drafted" }) }),
      run(2, { ...good, metrics: metrics({ outcome: "nothing", story: undefined }) }),
    ]);
    expect(blocked.find((b) => b.bar === "Completion")?.pass).toBe(false);
    expect(blocked.find((b) => b.bar === "No blockers")?.pass).toBe(false);
  });

  it("adds the scorecard and CSV rows to the report", () => {
    const runs = [run(0, { judge: judgeAll(4), survey: { answers: { q6: { score: 5, why: "yes" } } } })];
    const md = reportMarkdown({ runs, insights: "x", url: "u", notes: [] });
    expect(md).toContain("## Scorecard");
    expect(md).toContain("```csv");
    expect(scorecardCsv(runs, { date: "2026-11-08" })[0]).toMatch(/^2026-11-08,,sales-engineer,Senior,m,graded,80,4,4,4,4,4,4,4,,,,,,5$/);
  });
});

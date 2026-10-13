import { describe, expect, it } from "vitest";
import { parseContent } from "./content";
import { FIT_SYSTEM, fitMessages, parseFit, parseStoredFit, type FitJob } from "./fit";
import { getStoryType } from "./story-types";

const jobs: FitJob[] = [
  {
    id: "job-a",
    title: "Principal Solutions Engineer",
    company: "Acme",
    level: "principal",
    focus: ["Leading technical wins on enterprise deals", "Mentoring other SEs"],
    description: "ignored when focus is present",
    questions: ["Tell me about a deal you turned around.", "How do you coach junior SEs?"],
  },
  {
    id: "job-b",
    title: "Solutions Engineer",
    company: null,
    level: null,
    focus: [],
    description: "We need someone who can run demos for mid-market customers.",
    questions: [],
  },
];

describe("content check prompt", () => {
  it("lists each job with its level, needs and numbered questions, plus the answers", () => {
    const [message] = fitMessages({
      storyText: "I saved the renewal.",
      answers: "Q: What was at stake?\nA: A $2.4M renewal.",
      jobs,
      storyType: getStoryType("major_project"),
    });
    expect(message.content).toContain("j1: Principal Solutions Engineer at Acme");
    expect(message.content).toContain("Level: Principal or above");
    expect(message.content).toContain("- Mentoring other SEs");
    expect(message.content).toContain("2. How do you coach junior SEs?");
    expect(message.content).not.toContain("ignored when focus is present");
    expect(message.content).toContain("j2: Solutions Engineer\nLevel: not set\nPosting:");
    expect(message.content).toContain("A $2.4M renewal.");
    expect(FIT_SYSTEM).toMatch(/never invent or change a fact/);
  });
});

describe("parseFit", () => {
  it("maps jobs back by position, turns question numbers into questions and drops bad values", () => {
    const reply = JSON.stringify({
      jobs: {
        j1: {
          fit: "partial",
          proves: ["Technical win: you rebuilt the demo.", ""],
          misses: ["Mentoring other SEs"],
          answers: [1, 1, 3, "x"],
          level: { match: "below", note: "One deal, hands-on." },
        },
        j2: { fit: "strong", proves: [], answers: [1], level: { match: "matches", note: "n/a" } },
        j3: { fit: "strong" },
      },
      unused: ["Your answer says you were top of 9 SEs."],
    });
    const check = parseFit(`Sure:\n${reply}`, jobs, "openai/gpt-5.5");
    expect(check.jobs).toHaveLength(2);
    const [a, b] = check.jobs;
    expect(a).toMatchObject({
      jobId: "job-a",
      company: "Acme",
      fit: "partial",
      proves: ["Technical win: you rebuilt the demo."],
      misses: ["Mentoring other SEs"],
      answers: ["Tell me about a deal you turned around."],
      level: { match: "below", note: "One deal, hands-on." },
    });
    // No level set on the job, and no questions to answer.
    expect(b.level).toBeUndefined();
    expect(b.answers).toEqual([]);
    expect(check.unused).toEqual(["Your answer says you were top of 9 SEs."]);
  });

  it("skips a job with an unknown fit and rejects a reply without jobs", () => {
    const check = parseFit('{"jobs": {"j1": {"fit": "great"}}}', jobs, "m");
    expect(check.jobs).toEqual([]);
    expect(() => parseFit("no json", jobs, "m")).toThrow(/unexpected format/);
  });
});

describe("saved content checks", () => {
  it("round-trip through a saved grade", () => {
    const check = parseFit(
      JSON.stringify({
        jobs: { j1: { fit: "strong", proves: ["x"], answers: [2], level: { match: "matches" } } },
        unused: [],
      }),
      jobs,
      "m",
    );
    const stored = JSON.parse(JSON.stringify(check));
    expect(parseStoredFit(stored)).toEqual(check);
    const content = parseContent({
      answers: {},
      grade: {
        tier: "good_enough",
        criteria: [],
        checks: [],
        content: stored,
      },
    });
    expect(content.grade?.content?.jobs[0].answers).toEqual(["How do you coach junior SEs?"]);
    expect(parseStoredFit({ jobs: [{ fit: "strong" }] })?.jobs).toEqual([]);
    expect(parseStoredFit(undefined)).toBeUndefined();
  });
});

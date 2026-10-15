import { describe, expect, it } from "vitest";
import type { StoryContent } from "@/lib/stories/content";
import {
  type PlanInput,
  type PlanJob,
  buildPlan,
  daysUntil,
  focusJob,
  horizonFor,
  isDate,
  todayIn,
  whenLabel,
} from "./plan";

const TODAY = "2026-10-14";
const draft = { draft: {} } as unknown as Partial<StoryContent>;
const content = (extra: Partial<StoryContent> = {}) =>
  ({ version: 1, answers: {}, ...extra }) as StoryContent;

const JOB: PlanJob = {
  id: "job-1",
  title: "Senior PM",
  company: "Acme",
  interviewDate: null,
  likelyQuestions: {
    questions: [
      { theme: "about_you" },
      { theme: "impact" },
      { theme: "conflict" },
      { theme: "failure" },
      { theme: "influence" },
      { theme: "ambiguity" },
    ],
  },
};

function input(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    job: JOB,
    today: TODAY,
    stories: [],
    numbers: null,
    storyPlan: ["major_project"],
    ...overrides,
  };
}

const ids = (plan: ReturnType<typeof buildPlan>) => plan.steps.map((s) => s.id);
const next = (plan: ReturnType<typeof buildPlan>) => plan.steps.find((s) => !s.done);

describe("dates", () => {
  it("checks real calendar dates", () => {
    expect(isDate("2026-10-16")).toBe(true);
    expect(isDate("2026-02-30")).toBe(false);
    expect(isDate("16/10/2026")).toBe(false);
    expect(isDate(null)).toBe(false);
  });

  it("counts days and names them", () => {
    expect(daysUntil("2026-10-15", TODAY)).toBe(1);
    expect(daysUntil("2026-11-01", TODAY)).toBe(18);
    expect(whenLabel(0)).toBe("today");
    expect(whenLabel(1)).toBe("tomorrow");
    expect(whenLabel(5)).toBe("in 5 days");
    expect(whenLabel(21)).toBe("in 3 weeks");
  });

  it("uses the user's own date, falling back to UTC", () => {
    const lateEvening = new Date("2026-10-15T02:00:00Z");
    expect(todayIn("America/Los_Angeles", lateEvening)).toBe("2026-10-14");
    expect(todayIn(null, lateEvening)).toBe("2026-10-15");
    expect(todayIn("Not/AZone", lateEvening)).toBe("2026-10-15");
  });

  it("sizes the plan to the time left", () => {
    expect(horizonFor(0)).toBe("crunch");
    expect(horizonFor(1)).toBe("crunch");
    expect(horizonFor(2)).toBe("week");
    expect(horizonFor(7)).toBe("week");
    expect(horizonFor(8)).toBe("full");
  });
});

describe("focusJob", () => {
  it("picks the nearest interview still ahead", () => {
    const jobs = [
      { ...JOB, id: "a", interviewDate: "2026-10-30" },
      { ...JOB, id: "b", interviewDate: "2026-10-10" },
      { ...JOB, id: "c", interviewDate: "2026-10-20" },
    ];
    expect(focusJob(jobs, TODAY)?.id).toBe("c");
  });

  it("without dates, prefers a job with likely questions", () => {
    const jobs = [
      { ...JOB, id: "a", likelyQuestions: null },
      { ...JOB, id: "b" },
    ];
    expect(focusJob(jobs, TODAY)?.id).toBe("b");
    expect(focusJob([], TODAY)).toBeNull();
  });
});

describe("buildPlan", () => {
  it("tomorrow: questions, About me for the company, top 3, one tough question; brief later", () => {
    const plan = buildPlan(input({ job: { ...JOB, interviewDate: "2026-10-15" } }));
    expect(plan).toMatchObject({ horizon: "crunch", basis: "date", days: 1 });
    expect(ids(plan)).toEqual(["questions", "aboutMe", "answers", "tough"]);
    expect(plan.steps[2].label).toContain("top 3");
    expect(plan.steps[3]).toMatchObject({ href: "/tough-questions", done: false });
    expect(plan.later.map((s) => s.id)).toEqual(["brief"]);
  });

  it("the tough question step opens the answer in progress, and is done once one is written", () => {
    const job = { ...JOB, interviewDate: "2026-10-15" };
    const started = { id: "t1", title: "Why are you leaving?", storyType: "tough_why_leaving" };
    let plan = buildPlan(input({ job, stories: [{ ...started, content: content() }] }));
    expect(plan.steps[3]).toMatchObject({ href: "/tough-questions/t1", done: false });
    plan = buildPlan(input({ job, stories: [{ ...started, content: content(draft) }] }));
    expect(plan.steps[3]).toMatchObject({
      href: "/tough-questions/t1",
      detail: "Why are you leaving?",
      done: true,
    });
  });

  it("this week: adds numbers and the top 5, then practice", () => {
    const plan = buildPlan(input({ job: { ...JOB, interviewDate: "2026-10-19" } }));
    expect(plan.horizon).toBe("week");
    expect(ids(plan)).toEqual(["questions", "aboutMe", "numbers", "answers", "practice"]);
    expect(plan.steps[3].detail).toBe("0 of 5 answered");
    expect(plan.steps[4]).toMatchObject({ href: "/jobs/job-1/practice", done: false });
    expect(plan.later).toEqual([]);
  });

  it("a finished practice round ticks off the practice step", () => {
    const plan = buildPlan(
      input({ job: { ...JOB, interviewDate: "2026-10-19" }, practiced: true }),
    );
    expect(plan.steps.find((s) => s.id === "practice")?.done).toBe(true);
  });

  it("two weeks or more: the full bank", () => {
    const plan = buildPlan(input({ job: { ...JOB, interviewDate: "2026-11-01" } }));
    expect(plan.horizon).toBe("full");
    expect(ids(plan)).toEqual([
      "questions",
      "numbers",
      "aboutMe",
      "storyPlan",
      "answers",
      "practice",
    ]);
    expect(plan.steps[4].detail).toBe("0 of 6 answered");
  });

  it("a past date is ignored", () => {
    const plan = buildPlan(input({ job: { ...JOB, interviewDate: "2026-10-01" } }));
    expect(plan).toMatchObject({ horizon: null, basis: "none", days: null });
  });

  it("without a date, uses the journey check's answer", () => {
    expect(buildPlan(input({ nextInterview: "days" }))).toMatchObject({
      horizon: "crunch",
      basis: "assessment",
    });
    expect(buildPlan(input({ nextInterview: "soon" })).horizon).toBe("week");
    expect(buildPlan(input({ nextInterview: "none" })).basis).toBe("none");
  });

  it("a date beats the journey check", () => {
    const plan = buildPlan(
      input({
        job: { ...JOB, interviewDate: "2026-11-01" },
        nextInterview: "days",
      }),
    );
    expect(plan).toMatchObject({ horizon: "full", basis: "date" });
  });

  it("with no date, a written About me is enough", () => {
    const intro = {
      id: "s1",
      title: "About me",
      storyType: "about_me",
      content: content(draft),
    };
    const plan = buildPlan(input({ stories: [intro] }));
    expect(plan.steps.find((s) => s.id === "aboutMe")?.done).toBe(true);
  });

  it("with an interview coming, About me must be shaped for that company", () => {
    const job = { ...JOB, interviewDate: "2026-10-15" };
    const intro = {
      id: "s1",
      title: "About me",
      storyType: "about_me",
      content: content(draft),
    };
    const plain = buildPlan(input({ job, stories: [intro] }));
    expect(plain.steps[1]).toMatchObject({
      done: false,
      label: "Tell me about yourself, for Acme",
      href: "/jobs/job-1#about-me",
    });
    const tailored = {
      ...intro,
      content: content({
        ...draft,
        tailored: { "job-1": { whyCompany: "", draft: {} } },
      } as unknown as Partial<StoryContent>),
    };
    expect(buildPlan(input({ job, stories: [tailored] })).steps[1].done).toBe(true);
  });

  it("the next step goes to the story in progress for the first open question", () => {
    const job = { ...JOB, interviewDate: "2026-10-15" };
    const stories = [
      {
        id: "s1",
        title: "About me",
        storyType: "about_me",
        content: content(draft),
      },
      {
        id: "s2",
        title: "Launch",
        storyType: "major_project",
        content: content(),
      },
    ];
    const step = buildPlan(input({ job, stories })).steps[2];
    expect(step).toMatchObject({
      detail: "1 of 3 answered",
      href: "/stories/s2",
      done: false,
    });
  });

  it("before likely questions, the first step is predicting them", () => {
    const plan = buildPlan(
      input({
        job: { ...JOB, likelyQuestions: null, interviewDate: "2026-10-15" },
      }),
    );
    expect(next(plan)?.id).toBe("questions");
    expect(plan.steps[2].done).toBe(false);
  });
});

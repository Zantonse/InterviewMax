import { describe, expect, it } from "vitest";
import type { LikelyQuestion } from "@/lib/questions/content";
import { type StoryContent, emptyContent } from "@/lib/stories/content";
import { currentStep, jobSteps, nextStoryToBuild } from "./journey";

const DRAFT = {
  text: "A story.",
  parts: {},
  untracedNumbers: [],
  model: "test",
  writtenAt: "2026-10-14T00:00:00Z",
};

function story(id: string, storyType: string, written: boolean, extra: Partial<StoryContent> = {}) {
  return {
    id,
    title: id,
    storyType,
    content: { ...emptyContent(), ...(written ? { draft: DRAFT } : {}), ...extra },
  };
}

function question(theme: string): LikelyQuestion {
  return { question: `About ${theme}?`, theme, why: "", source: "common", specific: false } as LikelyQuestion;
}

const JOB = {
  id: "job-1",
  levelConfirmed: false,
  likelyQuestions: { questions: [question("conflict"), question("failure")] },
};

describe("jobSteps", () => {
  it("starts at the questions when none are predicted", () => {
    const steps = jobSteps({
      job: { ...JOB, likelyQuestions: null },
      company: "Acme",
      intro: undefined,
      stories: [],
    });
    expect(currentStep(steps)?.id).toBe("questions");
    expect(steps.find((s) => s.id === "stories")?.done).toBe(false);
  });

  it("moves to the level, then About me for the company", () => {
    const first = jobSteps({ job: JOB, company: "Acme", intro: undefined, stories: [] });
    expect(currentStep(first)?.id).toBe("level");
    const second = jobSteps({
      job: { ...JOB, levelConfirmed: true },
      company: "Acme",
      intro: undefined,
      stories: [],
    });
    expect(currentStep(second)?.id).toBe("about-me");
    expect(currentStep(second)?.label).toContain("Acme");
  });

  it("counts top questions with a written story", () => {
    const intro = story("intro", "about_me", true, {
      tailored: { "job-1": { whyCompany: "x", draft: { parts: {}, angle: "", untracedNumbers: [], model: "t", writtenAt: "" } } },
    } as Partial<StoryContent>);
    const steps = jobSteps({
      job: { ...JOB, levelConfirmed: true },
      company: "Acme",
      intro: { content: intro.content, ready: true },
      stories: [intro, story("s1", "difficult_stakeholder", true), story("s2", "went_wrong", false)],
    });
    const stories = steps.find((s) => s.id === "stories")!;
    expect(stories.detail).toBe("1 of 2 ready");
    expect(currentStep(steps)?.id).toBe("stories");
  });

  it("ends with practice, done once a round is finished", () => {
    const intro = story("intro", "about_me", true, {
      tailored: { "job-1": { whyCompany: "x", draft: { parts: {}, angle: "", untracedNumbers: [], model: "t", writtenAt: "" } } },
    } as Partial<StoryContent>);
    const steps = jobSteps({
      job: { ...JOB, levelConfirmed: true },
      company: "Acme",
      intro: { content: intro.content, ready: true },
      stories: [intro, story("s1", "difficult_stakeholder", true), story("s2", "went_wrong", true)],
    });
    expect(currentStep(steps)?.id).toBe("practice");
    expect(currentStep(steps)?.href).toBe("/jobs/job-1/practice");
    const practiced = jobSteps({
      job: { ...JOB, levelConfirmed: true },
      company: "Acme",
      intro: { content: intro.content, ready: true },
      stories: [intro, story("s1", "difficult_stakeholder", true), story("s2", "went_wrong", true)],
      practiced: true,
    });
    expect(currentStep(practiced)).toBeUndefined();
  });
});

describe("nextStoryToBuild", () => {
  const order = [
    { storyType: "about_me", why: "Opens" },
    { storyType: "major_project", why: "Impact" },
    { storyType: "went_wrong", why: "Failure" },
    { storyType: "cross_team", why: "Teams" },
  ] as Parameters<typeof nextStoryToBuild>[0];

  it("skips About me, the current story and written ones", () => {
    const next = nextStoryToBuild(order, [story("a", "went_wrong", true)], "major_project");
    expect(next?.storyType).toBe("cross_team");
    expect(next?.storyId).toBeUndefined();
  });

  it("continues an unfinished story instead of starting another", () => {
    const next = nextStoryToBuild(order, [story("b", "major_project", false)], "went_wrong");
    expect(next).toMatchObject({ storyType: "major_project", storyId: "b", why: "Impact" });
  });

  it("returns nothing when the plan is done", () => {
    const stories = ["major_project", "went_wrong", "cross_team"].map((t) => story(t, t, true));
    expect(nextStoryToBuild(order, stories, null)).toBeUndefined();
  });
});

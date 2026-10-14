import { describe, expect, it } from "vitest";
import { emptyContent } from "./content";
import { probeMessages, probeSystem } from "./prompts";
import { getStoryType } from "./story-types";
import {
  builderTargets,
  hasTargets,
  nextRoleHint,
  openingHint,
  targetsTranscript,
  type BuilderTargets,
} from "./targets";

const stakeholder = getStoryType("difficult_stakeholder");
const aboutMe = getStoryType("about_me");

const jobs = [
  {
    id: "j1",
    title: "Senior Product Manager",
    company: "Stripe",
    level: "senior",
    likelyQuestions: {
      questions: [
        { question: "Tell me about a time you failed.", theme: "failure" },
        {
          question: "Tell me about a difficult stakeholder at Stripe scale.",
          theme: "conflict",
        },
        {
          question: "Tell me about a time you persuaded an exec.",
          theme: "influence",
        },
      ],
    },
  },
  {
    id: "j2",
    title: "Group PM",
    company: null,
    level: "principal",
    likelyQuestions: null,
  },
];

describe("builderTargets", () => {
  it("keeps only the likely questions this story type answers, with each job's focus", () => {
    const targets = builderTargets({
      jobs,
      focus: { j1: { focus: ["Enterprise payments", "Cross-team influence"] } },
      wantedRole: "  A senior PM role in fintech  ",
      storyType: stakeholder,
    });
    expect(targets.jobs[0].questions).toEqual([
      "Tell me about a difficult stakeholder at Stripe scale.",
      "Tell me about a time you persuaded an exec.",
    ]);
    expect(targets.jobs[0].focus).toEqual([
      "Enterprise payments",
      "Cross-team influence",
    ]);
    expect(targets.jobs[1]).toMatchObject({ focus: [], questions: [] });
    expect(targets.wantedRole).toBe("A senior PM role in fintech");
  });

  it("has no targets without jobs or a wanted role", () => {
    const targets = builderTargets({ jobs: [], storyType: stakeholder });
    expect(hasTargets(targets)).toBe(false);
    expect(openingHint(targets, stakeholder)).toBeUndefined();
    expect(probeSystem(stakeholder, 1, targets)).toBe(
      probeSystem(stakeholder, 1),
    );
  });
});

describe("follow-up prompts with targets", () => {
  const targets = builderTargets({
    jobs,
    focus: { j1: { focus: ["Enterprise payments"] } },
    wantedRole: "A senior PM role in fintech",
    storyType: stakeholder,
  });

  it("lists the jobs, level and the scope to draw out from the most senior job", () => {
    const text = targetsTranscript(targets);
    expect(text).toContain("Target job 1: Senior Product Manager at Stripe");
    expect(text).toContain("Level: Senior");
    expect(text).toContain("- Enterprise payments");
    expect(text).toContain("Target job 2: Group PM");
    expect(text).toContain("A senior PM role in fintech");
    expect(text).toMatch(/Scope to draw out: Principal/);
  });

  it("adds the tailoring rules and the targets only when there are some", () => {
    expect(probeSystem(stakeholder, 1, targets)).toContain(
      "Tailor to what they're preparing for",
    );
    expect(probeSystem(stakeholder, 1)).not.toContain(
      "Tailor to what they're preparing for",
    );
    expect(probeSystem(aboutMe, 1, targets)).toContain('the "next" part');
    const [message] = probeMessages(
      emptyContent(),
      stakeholder,
      undefined,
      undefined,
      [],
      targets,
    );
    expect(message.content).toContain("## What I'm preparing for");
    const [plain] = probeMessages(emptyContent(), stakeholder);
    expect(plain.content).not.toContain("What I'm preparing for");
  });
});

describe("hints under the scripted questions", () => {
  const targets: BuilderTargets = builderTargets({
    jobs,
    storyType: stakeholder,
  });

  it("names the job, a likely question and the level's scope on the opening question", () => {
    expect(openingHint(targets, stakeholder)).toBe(
      "You're preparing for Senior Product Manager at Stripe (and 1 more job). Pick an example that would answer “Tell me about a difficult stakeholder at Stripe scale”, ideally an example whose impact reached across teams or the organization.",
    );
  });

  it("falls back to the job's needs when it has no matching likely question", () => {
    const only = builderTargets({ jobs: [jobs[1]], storyType: stakeholder });
    expect(openingHint(only, stakeholder)).toBe(
      "You're preparing for Group PM. Pick an example that shows what that job needs, ideally an example whose impact reached across teams or the organization.",
    );
  });

  it("asks About me what draws them to their target jobs", () => {
    expect(openingHint(targets, aboutMe)).toBeUndefined();
    expect(nextRoleHint(targets)).toBe(
      "You've added Senior Product Manager at Stripe and Group PM as target jobs. Say what draws you to roles like these, in your own words.",
    );
    expect(
      nextRoleHint(builderTargets({ jobs: [], storyType: aboutMe })),
    ).toBeUndefined();
  });
});

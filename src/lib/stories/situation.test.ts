import { describe, expect, it } from "vitest";
import { questionHelp } from "./help";
import { probeSystem, weakPartProbeSystem } from "./prompts";
import { quickStartRows } from "./quick-start";
import {
  joggersFor,
  managesPeopleFrom,
  managesPeopleTitle,
  questionFor,
  situationFor,
  situationRules,
  stakesFor,
  storySituation,
} from "./situation";
import { coreQuestionText, getStoryType } from "./story-types";
import { builderTargets, jobsToAimAt, nextRoleHint, openingHint } from "./targets";

const aboutMe = getStoryType("about_me");
const project = getStoryType("major_project");

describe("managesPeopleFrom", () => {
  it("reads managing people from their own words, and only then", () => {
    expect(managesPeopleFrom("I manage a team of 6 data engineers at Acme.")).toBe(true);
    expect(managesPeopleFrom("I'm an engineering manager with 8 direct reports.")).toBe(true);
    expect(managesPeopleFrom("I lead the data platform team at Acme.")).toBe(true);
    expect(managesPeopleFrom("I'm a data engineer at Acme; I own the governance catalog.")).toBe(false);
    expect(managesPeopleFrom("I'm a senior product manager at Stripe.")).toBe(false);
    expect(managesPeopleFrom("I support a team of 8 account executives.")).toBe(false);
    expect(managesPeopleFrom("I lead the governance program.")).toBe(false);
    expect(managesPeopleFrom("  ")).toBeNull();
    expect(managesPeopleFrom(undefined)).toBeNull();
  });

  it("tells people-manager titles from ones that aren't", () => {
    expect(managesPeopleTitle("Data Engineering & Architecture Manager")).toBe(true);
    expect(managesPeopleTitle("Director of Analytics")).toBe(true);
    expect(managesPeopleTitle("Senior Product Manager")).toBe(false);
    expect(managesPeopleTitle("Account Manager")).toBe(false);
    expect(managesPeopleTitle("Data Engineer")).toBe(false);
  });
});

describe("situationFor", () => {
  it("is entry level only when every open job with a level is", () => {
    expect(situationFor({ jobs: [{ title: "Analyst", level: "entry" }] }).entry).toBe(true);
    expect(
      situationFor({
        jobs: [
          { title: "Analyst", level: "entry" },
          { title: "Analyst II", level: "mid" },
        ],
      }).entry,
    ).toBe(false);
    expect(situationFor({}).entry).toBe(false);
  });

  it("flags a step up to managing people only when they've said they don't yet", () => {
    const jobs = [{ title: "Data Engineering & Architecture Manager", level: "senior" }];
    expect(situationFor({ jobs, currentRole: "I'm a data engineer at Acme." }).toManager).toBe(true);
    expect(situationFor({ jobs, currentRole: "I manage a team of 4 at Acme." }).toManager).toBe(false);
    expect(situationFor({ jobs }).toManager).toBe(false);
  });
});

describe("questionFor", () => {
  const entry = situationFor({ jobs: [{ title: "Junior Analyst", level: "entry" }] });
  const dg = situationFor({ field: "data_governance" });

  it("asks entry-level candidates About me without assuming years of work", () => {
    const now = questionFor("now", aboutMe, undefined, entry);
    expect(now).toMatch(/studying, an internship, a first job/);
    expect(now).not.toMatch(/team's size|territory|budget/);
    expect(questionFor("path", aboutMe, undefined, entry)).toMatch(/what got you into this field/i);
    expect(questionFor("highlight", aboutMe, undefined, entry)).toMatch(/school, an internship/);
    expect(questionFor("known_for", aboutMe, undefined, entry)).toMatch(/classmates/);
    // "next" stays as it is.
    expect(questionFor("next", aboutMe, undefined, entry)).toBe(coreQuestionText("next", aboutMe));
  });

  it("adds the field's scope and kinds of result to About me", () => {
    expect(questionFor("now", aboutMe, undefined, dg)).toMatch(/data domains/);
    const highlight = questionFor("highlight", aboutMe, undefined, dg);
    expect(highlight).toContain(coreQuestionText("highlight", aboutMe));
    expect(highlight).toMatch(/data quality fix/);
    expect(questionFor("highlight", aboutMe, undefined, situationFor({}))).toBe(
      coreQuestionText("highlight", aboutMe),
    );
  });

  it("tells entry-level candidates that school and internships count in a behavioral opening", () => {
    expect(questionFor("start", project, undefined, entry)).toMatch(/school, an internship/);
    expect(questionFor("start", project, "Tell me about a hard project", entry)).toMatch(
      /^Tell me about a hard project\..*school, an internship/,
    );
    expect(questionFor("start", project, undefined, dg)).toBe(coreQuestionText("start", project));
  });
});

describe("joggers, quick start and examples", () => {
  const entry = situationFor({ field: "software_engineering", jobs: [{ title: "Junior Developer", level: "entry" }] });

  it("puts entry-level joggers ahead of the field's and the defaults", () => {
    expect(joggersFor(project, entry)[0]).toMatch(/class or capstone/);
    const swe = situationFor({ field: "software_engineering" });
    expect(joggersFor(project, swe)).not.toEqual(project!.joggers);
    expect(joggersFor(project, situationFor({}))).toEqual(project!.joggers);
  });

  it("swaps Quick start's stakes for the field or entry level, and a manager's part", () => {
    expect(stakesFor(entry)).toContain("A grade or project");
    const dgRows = quickStartRows("major_project", { stakes: stakesFor(situationFor({ field: "data_governance" })) });
    expect(dgRows[0].options).toContain("Bad data");
    expect(quickStartRows("major_project")[0].options).toContain("A customer");
    const manager = storySituation({ answers: { now: "I manage a team of 5 engineers." } }, aboutMe, undefined);
    expect(manager.managesPeople).toBe(true);
    // Taps are typed by the user's hand, so never a figure.
    for (const rows of [dgRows, quickStartRows("went_wrong", { stakes: stakesFor(entry) })]) {
      for (const row of rows) for (const o of row.options) expect(o).not.toMatch(/\d/);
    }
  });

  it("shows entry-level examples first", () => {
    expect(questionHelp("present", "sales_engineering", true)?.example).toMatch(/degree/);
    expect(questionHelp("present", "sales_engineering")?.example).not.toMatch(/degree/);
  });
});

describe("the follow-up coach", () => {
  it("says who it's helping and what fits them", () => {
    const entry = situationFor({ jobs: [{ title: "Analyst", level: "entry" }] });
    const system = probeSystem(project, 1, undefined, undefined, undefined, entry);
    expect(system).toMatch(/someone early in their career/);
    expect(system).not.toMatch(/experienced professional/);
    expect(system).toMatch(/Never ask for a team, budget, revenue/);
    expect(probeSystem(project, 1)).toMatch(/experienced professional/);
    expect(probeSystem(project, 1)).not.toMatch(/About this person/);

    const ic = situationFor({
      jobs: [{ title: "Data Engineering & Architecture Manager", level: "senior" }],
      currentRole: "I'm a data engineer at Acme.",
    });
    const rules = situationRules(ic);
    expect(rules).toMatch(/individual contributor/);
    expect(rules).toMatch(/leading others without the title/);
    expect(weakPartProbeSystem(aboutMe, { id: "next", label: "Why this next role", score: 2, note: "x", improve: "" }, 3, undefined, ic)).toContain(rules);
    expect(situationRules(situationFor({}))).toBe("");
  });
});

describe("which jobs the builder aims at", () => {
  const job = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    title: `Job ${id}`,
    company: null,
    level: "senior",
    likelyQuestions: null,
    ...extra,
  });

  it("drops finished jobs and puts the nearest interview first", () => {
    const old = Array.from({ length: 6 }, (_, i) => job(`old${i}`, { outcome: "rejected" }));
    const jobs = [...old, job("undated"), job("later", { interviewDate: "2026-12-01" }), job("soon", { interviewDate: "2026-11-18" })];
    expect(jobsToAimAt(jobs).map((j) => j.id)).toEqual(["soon", "later", "undated"]);
  });

  it("carries the next stage and their current role", () => {
    const targets = builderTargets({
      jobs: [job("a", { nextStage: "hiring_manager" }), job("b", { nextStage: "nonsense" })],
      currentRole: "  I'm a data engineer.  ",
      storyType: project,
    });
    expect(targets.jobs[0].stage).toBe("hiring_manager");
    expect(targets.jobs[1].stage).toBeUndefined();
    expect(targets.currentRole).toBe("I'm a data engineer.");
  });

  it("nudges toward leading others when the jobs manage people", () => {
    const targets = builderTargets({
      jobs: [job("a", { title: "Engineering Manager" })],
      storyType: project,
    });
    expect(openingHint(targets, project, true)).toMatch(/led others, even without the title/);
    expect(openingHint(targets, project)).not.toMatch(/without the title/);
    expect(nextRoleHint(targets, true)).toMatch(/why you want to lead a team now/);
  });
});

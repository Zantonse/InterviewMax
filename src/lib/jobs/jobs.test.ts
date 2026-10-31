import { describe, expect, it } from "vitest";
import { STORY_TYPES } from "@/lib/stories/story-types";
import {
  completeStoryOrder,
  overviewBasis,
  parseOverview,
  parseResume,
  suggestLevel,
  titleFromPosting,
} from "./content";
import { jobsReadMessages, parseJobsRead, sourceText, type JobForPrompt } from "./prompts";

const jobs: JobForPrompt[] = [
  {
    id: "a1",
    title: "Senior Solutions Engineer",
    company: "Acme",
    level: "senior",
    description: "Support 6 AEs across a $40M territory. Run technical discovery and demos.",
  },
  {
    id: "b2",
    title: "Solutions Architect",
    company: null,
    level: "mid",
    description: "Design integrations for enterprise customers.",
  },
];

describe("suggestLevel", () => {
  it.each([
    ["Senior Solutions Engineer", "senior"],
    ["Sr. Data Analyst", "senior"],
    ["Lead Data Steward", "senior"],
    ["Principal Engineer", "principal"],
    ["Senior Director, Finance", "principal"],
    ["Head of Data Governance", "principal"],
    ["VP Sales Engineering", "principal"],
    ["Staff Product Manager", "principal"],
    ["Financial Analyst", "mid"],
    ["Solutions Engineer", "mid"],
    ["Junior Data Analyst", "entry"],
    ["Software Engineering Intern", "entry"],
    ["Entry-Level Accountant", "entry"],
    ["Associate Product Manager", "entry"],
    ["Software Engineer I", "entry"],
    ["Senior Associate", "senior"],
    ["Associate Director, Finance", "principal"],
    ["AI Engineer", "mid"],
  ])("%s → %s", (title, level) => {
    expect(suggestLevel(title)).toBe(level);
  });
});

describe("completeStoryOrder", () => {
  it("puts Tell me about yourself first and lists every type once", () => {
    const order = completeStoryOrder([
      { storyType: "cross_team", why: "lots of partners" },
      { storyType: "about_me", why: "opener" },
      { storyType: "cross_team", why: "again" },
    ]);
    expect(order.map((p) => p.storyType)).toEqual([
      "about_me",
      "cross_team",
      ...STORY_TYPES.map((t) => t.id).filter((id) => id !== "about_me" && id !== "cross_team"),
    ]);
    expect(order[0].why).toBe("opener");
    expect(order[1].why).toBe("lots of partners");
  });
});

describe("overviewBasis", () => {
  it("ignores job order and changes with the resume", () => {
    const resume = { fileName: "", text: "x", updatedAt: "2026-10-13T00:00:00Z" };
    expect(overviewBasis(["b", "a"], resume)).toBe(overviewBasis(["a", "b"], resume));
    expect(overviewBasis(["a"], resume)).not.toBe(overviewBasis(["a"], null));
    expect(overviewBasis(["a"], null)).not.toBe(overviewBasis(["a", "b"], null));
  });
});

describe("parsing stored jsonb", () => {
  it("returns null for missing or malformed values", () => {
    expect(parseResume(null)).toBeNull();
    expect(parseResume({ text: "" })).toBeNull();
    expect(parseOverview("nope")).toBeNull();
  });

  it("keeps only well-formed fields", () => {
    const overview = parseOverview({
      shared: ["discovery", 3, ""],
      jobs: { a1: { summary: " SE role ", focus: ["demos", null] }, bad: "x" },
      storyOrder: ["went_wrong", "nonsense"],
      basis: "a1|",
    });
    expect(overview?.shared).toEqual(["discovery"]);
    expect(overview?.jobs).toEqual({ a1: { summary: "SE role", differs: "", focus: ["demos"] } });
    expect(overview?.storyOrder.slice(0, 2).map((p) => p.storyType)).toEqual([
      "about_me",
      "went_wrong",
    ]);
    expect(overview?.resumeFit).toBeUndefined();
  });
});

describe("jobsRead prompt", () => {
  it("numbers the jobs and says when there's no resume", () => {
    const [message] = jobsReadMessages(jobs, null);
    expect(message.content).toContain("## job1: Senior Solutions Engineer at Acme (Senior)");
    expect(message.content).toContain("## job2: Solutions Architect (Mid-level)\n");
    expect(message.content).toContain("I haven't added a resume.");
  });

  it("maps job keys back to ids and drops lines with figures not in the sources", () => {
    const resume = { fileName: "cv.pdf", text: "Supported 4 AEs; 120% of quota.", updatedAt: "" };
    const reply = `Sure:\n${JSON.stringify({
      shared: ["Technical discovery", "Supporting 6 AEs", "Closing 50 deals a year"],
      jobs: {
        job1: { summary: "SE for a $40M territory.", differs: "More sales-facing.", focus: ["Demos"] },
        job2: { summary: "Integration design.", differs: "Grew revenue 300%.", focus: [] },
        job9: { summary: "ghost" },
      },
      resumeFit: { strengths: ["120% of quota", "Led 12 launches"], gaps: ["No integrations work"] },
      storyOrder: [{ storyType: "major_project", why: "big deals" }],
    })}`;
    const read = parseJobsRead(reply, jobs, sourceText(jobs, resume), true);
    expect(read.shared).toEqual(["Technical discovery", "Supporting 6 AEs"]);
    expect(Object.keys(read.jobs)).toEqual(["a1", "b2"]);
    expect(read.jobs.a1.summary).toBe("SE for a $40M territory.");
    expect(read.jobs.b2.differs).toBe("");
    expect(read.resumeFit).toEqual({ strengths: ["120% of quota"], gaps: ["No integrations work"] });
    expect(read.storyOrder[0].storyType).toBe("about_me");
    expect(read.storyOrder[1]).toEqual({ storyType: "major_project", why: "big deals" });
  });

  it("leaves out the resume read without a resume, and differs with one job", () => {
    const reply = JSON.stringify({
      jobs: { job1: { summary: "SE role.", differs: "Unlike the others…" } },
      resumeFit: { strengths: ["x"] },
    });
    const read = parseJobsRead(reply, jobs.slice(0, 1), sourceText(jobs, null), false);
    expect(read.resumeFit).toBeUndefined();
    expect(read.jobs.a1.differs).toBe("");
  });

  it("throws on a reply it can't use", () => {
    expect(() => parseJobsRead("no json", jobs, "", false)).toThrow();
    expect(() => parseJobsRead('{"jobs": {"job7": {}}}', jobs, "", false)).toThrow();
  });
});

describe("titleFromPosting", () => {
  it("takes the first short line that isn't a heading", () => {
    expect(
      titleFromPosting("About the job\nSenior Solutions Engineer\nYou will run demos for customers."),
    ).toBe("Senior Solutions Engineer");
  });

  it("falls back when no line looks like a title", () => {
    expect(titleFromPosting("You will run technical discovery and demos for enterprise customers.")).toBe(
      "Untitled job",
    );
  });
});

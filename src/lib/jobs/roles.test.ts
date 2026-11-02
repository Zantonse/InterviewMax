import { describe, expect, it } from "vitest";
import { outcomeSummary } from "./outcome";
import {
  differenceText,
  parseOtherRoles,
  roleDifference,
  swapMainRole,
  withRoleQuestion,
  type JobRole,
} from "./roles";
import { parseLikelyQuestionsReply } from "@/lib/questions/prompts";
import type { LikelyQuestion } from "@/lib/questions/content";

const STRATEGIC = `Role Overview
This is our founding Solutions Engineer: the first technical seller. You'll own the technical side of the pre-sales cycle for prospective strategic customers.
What You'll Need
- 10+ years in solutions architecture, sales engineering, or a comparable pre-sales technical role.
- Excellent communication and storytelling.`;

const ENTERPRISE = `Role Overview
This role will be part of our founding Solutions Engineer team: the first technical sellers. You'll own the technical side of the pre-sales cycle for prospective strategic customers.
What You'll Need
- 5-7+ years in solutions architecture, sales engineering, or a comparable pre-sales technical role.
- Excellent communication and storytelling.
Must be in our San Francisco office.`;

const role = (over: Partial<JobRole> = {}): JobRole => ({
  id: "r1",
  title: "Solutions Engineer, Enterprise",
  level: "mid",
  levelConfirmed: false,
  description: ENTERPRISE,
  addedAt: "2026-11-02T00:00:00Z",
  ...over,
});

describe("several roles in one job", () => {
  it("reads other roles from jsonb, skipping bad rows and keeping at most three", () => {
    const roles = parseOtherRoles([
      { id: "a", title: "A", level: "senior", description: "x" },
      { id: "a", title: "dup" },
      { title: "no id" },
      { id: "b", title: "B", level: "boss" },
      { id: "c", title: "C" },
      { id: "d", title: "D" },
    ]);
    expect(roles.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(roles[1].level).toBeNull();
    expect(parseOtherRoles(null)).toEqual([]);
  });

  it("swaps the main role, keeping the old main in its place", () => {
    const job = {
      title: "Solutions Engineer, Strategic",
      level: "senior",
      levelConfirmed: true,
      description: STRATEGIC,
      createdAt: "2026-11-01T00:00:00Z",
      otherRoles: [role(), role({ id: "r2", title: "Solutions Engineer - Majors" })],
    };
    const next = swapMainRole(job, "r2")!;
    expect(next.title).toBe("Solutions Engineer - Majors");
    expect(next.otherRoles.map((r) => r.title)).toEqual([
      "Solutions Engineer, Enterprise",
      "Solutions Engineer, Strategic",
    ]);
    expect(next.otherRoles[1]).toMatchObject({ level: "senior", description: STRATEGIC });
    expect(swapMainRole(job, "nope")).toBeNull();
  });

  it("shows only the lines that differ, with the changed words marked", () => {
    const diff = roleDifference(ENTERPRISE, STRATEGIC);
    expect(diff.same).toBe(3);
    const text = differenceText(diff);
    expect(text).toHaveLength(3);
    expect(text[2]).toBe("Must be in our San Francisco office.");
    const years = diff.lines.find((l) => l.some((s) => s.text.includes("5-7+")))!;
    expect(years.filter((s) => s.changed).map((s) => s.text)).toEqual(["5-7+"]);
    expect(years.map((s) => s.text).join("")).toBe(
      "5-7+ years in solutions architecture, sales engineering, or a comparable pre-sales technical role.",
    );
    expect(roleDifference(STRATEGIC, STRATEGIC).lines).toEqual([]);
  });

  it("adds the also-considering question after the openers", () => {
    const q = (question: string): LikelyQuestion => ({
      question,
      theme: "impact",
      why: "",
      source: "common",
      specific: false,
    });
    const list = [q("one"), q("two"), q("three")];
    expect(withRoleQuestion(list, [], 10)).toBe(list);
    const added = withRoleQuestion(list, [{ title: "Majors" }, { title: "Enterprise" }], 3);
    expect(added.map((x) => x.question)).toEqual([
      "one",
      "two",
      "We're also considering you for Majors or Enterprise. How do you think about that?",
    ]);
  });

  it("keeps a role tag only for one of the job's roles", () => {
    const reply = JSON.stringify({
      questions: [
        { question: "Tell me about yourself.", theme: "about_you", source: "common" },
        { question: "Your largest deal?", theme: "impact", source: "posting", role: "solutions engineer, strategic" },
        { question: "A made-up role?", theme: "impact", source: "posting", role: "CEO" },
      ],
    });
    const roles = ["Solutions Engineer, Strategic", "Solutions Engineer, Enterprise"];
    const parsed = parseLikelyQuestionsReply(reply, { hasOtherJobs: false, hasReports: false, roles });
    expect(parsed.find((x) => x.question === "Your largest deal?")?.role).toBe(
      "Solutions Engineer, Strategic",
    );
    expect(parsed.find((x) => x.question === "A made-up role?")?.role).toBeUndefined();
    const single = parseLikelyQuestionsReply(reply, { hasOtherJobs: false, hasReports: false });
    expect(single.some((x) => x.role)).toBe(false);
  });

  it("says which role an offer was for", () => {
    expect(
      outcomeSummary({ outcome: "offer", roundReached: 4, roundName: "", offeredRole: "Strategic" }),
    ).toBe("Offer · Strategic · reached round 4");
  });
});

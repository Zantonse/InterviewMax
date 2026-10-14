import { describe, expect, it } from "vitest";
import {
  compareRuns,
  formatReport,
  handGradesFor,
  parseEvalSet,
  parseGradesCsv,
  type GraderRun,
} from "./eval";

const csv = `story,criterion,pre_grade,your_grade,reason,your_note
a,present,3,,"Clear, but long; ""quoted"" bit",
a,highlight,2,4,Hedged figure,Craig thinks it's fine
a,tier,good_enough,strong,Average 3.2,
b,present,4,,One line,
`;

describe("parseGradesCsv", () => {
  it("reads quoted fields and uses the human grade over the pre-grade", () => {
    const rows = parseGradesCsv(csv);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      story: "a",
      criterion: "present",
      grade: "3",
      confirmed: false,
      reason: 'Clear, but long; "quoted" bit',
    });
    expect(rows[1]).toMatchObject({ criterion: "highlight", grade: "4", confirmed: true });
    expect(rows[2]).toMatchObject({ criterion: "tier", grade: "strong", confirmed: true });
  });

  it("rejects a file without the expected columns", () => {
    expect(() => parseGradesCsv("story,score\na,3\n")).toThrow(/pre_grade/);
  });
});

describe("handGradesFor", () => {
  it("splits criterion scores from the tier", () => {
    const hand = handGradesFor("a", parseGradesCsv(csv));
    expect(hand.scores).toEqual({ present: 3, highlight: 4 });
    expect(hand.tier).toBe("strong");
    expect(hand.confirmed).toBe(2);
    expect(hand.total).toBe(3);
  });
});

describe("parseEvalSet", () => {
  it("reads stories and checks their type", () => {
    const set = parseEvalSet({
      stories: [{ id: "a", storyType: "about_me", title: "T", parts: { present: "x" } }],
    });
    expect(set[0]).toMatchObject({ id: "a", title: "T", untracedNumbers: [] });
    expect(() =>
      parseEvalSet({ stories: [{ id: "a", storyType: "nope", title: "T", parts: {} }] }),
    ).toThrow(/nope/);
  });
});

const runs: GraderRun[] = [
  { story: "a", run: 1, scores: { present: 3, highlight: 4 }, tier: "good_enough" },
  { story: "a", run: 2, scores: { present: 2, highlight: 4 }, tier: "good_enough" },
  { story: "b", run: 1, scores: { present: 4 }, tier: "strong" },
];

describe("compareRuns", () => {
  const rows = parseGradesCsv(csv);
  const result = compareRuns(rows, runs);

  it("counts exact and within-one agreement over every run", () => {
    // a/present: 3 vs 3 (exact), 3 vs 2 (off by 1); a/highlight 4 vs 4 twice; b/present 4 vs 4.
    expect(result.scored).toBe(5);
    expect(result.exact).toBe(4);
    expect(result.withinOne).toBe(5);
    expect(result.meanDiff).toBeCloseTo(-1 / 5);
  });

  it("compares tiers where a hand tier exists", () => {
    expect(result.tierScored).toBe(2);
    expect(result.tierExact).toBe(0);
  });

  it("lists disagreements, biggest first, and runs that disagree with each other", () => {
    expect(result.disagreements[0]).toMatchObject({
      story: "a",
      criterion: "tier",
      hand: "strong",
    });
    expect(result.disagreements.some((d) => d.criterion === "present" && d.story === "a")).toBe(
      true,
    );
    expect(result.unstable).toEqual([{ story: "a", criterion: "present", scores: [3, 2] }]);
  });

  it("reports per criterion", () => {
    const present = result.byCriterion.find((c) => c.criterion === "present");
    expect(present).toMatchObject({ scored: 3, exact: 2 });
  });
});

describe("formatReport", () => {
  it("writes a readable summary", () => {
    const rows = parseGradesCsv(csv);
    const text = formatReport({
      result: compareRuns(rows, runs),
      model: "openai/gpt-5.5",
      runsPerStory: 2,
      stories: 2,
      confirmed: 2,
      total: 4,
      date: "2026-10-14T00:00:00Z",
    });
    expect(text).toContain("openai/gpt-5.5");
    expect(text).toContain("Exact agreement: 80%");
    expect(text).toContain("2 of 4 hand grades confirmed");
    expect(text).toContain("| a | tier |");
  });
});

import { describe, expect, it } from "vitest";
import { findNumbers, keepTracedSentences, untracedNumbers } from "./numbers";

describe("findNumbers", () => {
  it("reads money, percentages, scales and multiples", () => {
    const values = findNumbers("Grew ARR from $2.4M to $3,100,000 (29%), 2x the plan, 15k users").map(
      (n) => n.value,
    );
    expect(values).toEqual([2_400_000, 3_100_000, 29, 2, 15_000]);
  });

  it("reads spelled-out numbers", () => {
    expect(findNumbers("I supported three AEs for a dozen accounts").map((n) => n.value)).toEqual([
      3, 12,
    ]);
  });

  it("ignores digits inside words like Q3 or FY24", () => {
    expect(findNumbers("In Q3 of FY24 we shipped")).toEqual([]);
  });
});

describe("untracedNumbers", () => {
  const answers = "We closed about $2.4M in new ARR across 3 accounts, up 40% on last year. I led a team of five.";

  it("passes numbers written differently but equal in value", () => {
    const draft = "I helped close about $2,400,000 in new ARR across three accounts, a 40% increase, leading 5 people.";
    expect(untracedNumbers(draft, answers)).toEqual([]);
  });

  it("flags numbers the user never gave", () => {
    const draft = "We closed $2.4M across 3 accounts, up 45%, saving 200 hours.";
    expect(untracedNumbers(draft, answers)).toEqual(["45%", "200"]);
  });

  it("flags a percent or money figure that only matches a count of something", () => {
    // Sims run 30: "rose 15%" came back as "from about 31% to about 46%" and passed on value.
    const given = "Win rate rose 15% on roughly 20 regulated deals. We had 46 deals in the pipe and 31 reps.";
    const draft = "Our win rate rose 15%, from about 31% to about 46%, on roughly 20 regulated deals.";
    expect(untracedNumbers(draft, given)).toEqual(["31%", "46%"]);
    expect(untracedNumbers("We lost $46 on it.", given)).toEqual(["$46"]);
  });

  it("lets a bare number or a range back a percent", () => {
    expect(untracedNumbers("It went from 31% to 46%.", "win rate went from 31 to 46")).toEqual([]);
    expect(untracedNumbers("It went from 31% to 46%.", "win rate went from 31 to 46%")).toEqual([]);
    expect(untracedNumbers("It went from 31% to 46%.", "from 31-46% over a year")).toEqual([]);
    expect(untracedNumbers("Up 15%.", "up 15 percent, or 15 points")).toEqual([]);
    expect(untracedNumbers("We saved $2.4M.", "saved 2.4 million")).toEqual([]);
  });

  it("doesn't let a percent back a count or money", () => {
    expect(untracedNumbers("We won 40 deals.", "up 40% on last year")).toEqual(["40"]);
  });

  it("doesn't flag 'one' or 'half' in ordinary prose", () => {
    expect(untracedNumbers("One of the accounts was half-built.", "no numbers here")).toEqual([]);
  });
});

describe("keepTracedSentences", () => {
  const profile = "Senior Manager, Product at Netflix. Jan 2022 - Present. Own the sales CRM: 500 users, $3B in revenue.";

  it("drops only the sentences with a number the source doesn't have", () => {
    const answer =
      "I'm a senior manager of product at Netflix. I own the sales CRM for 500 users and $3B in revenue. I've spent 12 years in sales tech.";
    expect(keepTracedSentences(answer, profile)).toBe(
      "I'm a senior manager of product at Netflix. I own the sales CRM for 500 users and $3B in revenue.",
    );
  });

  it("keeps decimals and line breaks intact", () => {
    expect(keepTracedSentences("Grew to $2.4M.\nLed three teams.", "ARR $2.4M")).toBe("Grew to $2.4M.");
    expect(keepTracedSentences("First line.\nSecond line.", "")).toBe("First line.\nSecond line.");
  });

  it("returns nothing when every sentence has an untraced number", () => {
    expect(keepTracedSentences("Two moves. 40% growth.", profile)).toBe("");
  });
});

import { describe, expect, it } from "vitest";
import { isOutcome, openJobs, outcomeSummary, parseRound } from "./outcome";

describe("job outcome", () => {
  it("accepts only known outcomes", () => {
    expect(isOutcome("offer")).toBe(true);
    expect(isOutcome("ghosted")).toBe(false);
    expect(isOutcome(null)).toBe(false);
  });

  it("reads a round from 1 to 10", () => {
    expect(parseRound("4")).toBe(4);
    expect(parseRound("0")).toBeNull();
    expect(parseRound("11")).toBeNull();
    expect(parseRound("2.5")).toBeNull();
    expect(parseRound("")).toBeNull();
  });

  it("summarizes the outcome and round", () => {
    expect(outcomeSummary({ outcome: "offer", roundReached: 4, roundName: "Onsite" })).toBe(
      "Offer · reached round 4 (Onsite)",
    );
    expect(outcomeSummary({ outcome: "rejected", roundReached: 2, roundName: "" })).toBe(
      "Not selected · reached round 2",
    );
    expect(outcomeSummary({ outcome: "withdrew", roundReached: null, roundName: "" })).toBe("Withdrew");
  });

  it("keeps jobs still in progress", () => {
    const jobs = [
      { id: "a", outcome: null },
      { id: "b", outcome: "offer" },
      { id: "c" },
    ];
    expect(openJobs(jobs).map((j) => j.id)).toEqual(["a", "c"]);
  });
});

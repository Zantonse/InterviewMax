import { describe, expect, it } from "vitest";
import { asksForNumber, questionHelp } from "./help";
import { INTRO_PARTS } from "./story-types";

describe("question help", () => {
  it("has an example for the telling, every follow-up gap and every intro part", () => {
    const keys = [
      "telling",
      "situation",
      "ownership",
      "actions",
      "decision",
      "result",
      "reflection",
      ...INTRO_PARTS.map((p) => p.id),
    ];
    for (const key of keys) expect(questionHelp(key)?.example, key).toBeTruthy();
    expect(questionHelp("result")?.whereToLook).toMatch(/estimate/);
    expect(questionHelp(undefined)).toBeUndefined();
  });

  it("spots questions that ask for a number", () => {
    expect(asksForNumber("Roughly how much did spend drop, before and after?")).toBe(true);
    expect(asksForNumber("About how many stewards used it?")).toBe(true);
    expect(asksForNumber("What did revenue look like?")).toBe(true);
    expect(asksForNumber("Anything", "result")).toBe(true);
    expect(asksForNumber("What made you go with that option over the other?", "decision")).toBe(
      false,
    );
  });
});

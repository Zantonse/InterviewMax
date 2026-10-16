import { describe, expect, it } from "vitest";
import { questionHelp } from "./help";
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
});

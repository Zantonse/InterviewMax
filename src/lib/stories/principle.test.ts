import { describe, expect, it } from "vitest";
import { TELL_SYSTEM } from "@/lib/telling/prompts";
import { draftText, gradeSystem } from "./grading";
import { PROBE_SYSTEM, parseWrite, probeSystem, WRITE_SYSTEM } from "./prompts";
import { getStoryType, STAR_PARTS } from "./story-types";

const story = getStoryType("cross_team");

describe("principle-first opening", () => {
  it("is the first part of a behavioral story", () => {
    expect(STAR_PARTS[0]).toEqual({ id: "principle", label: "How I think about it" });
  });

  it("is asked for once in the first round, and never suggested", () => {
    expect(PROBE_SYSTEM).toContain("- Principle:");
    expect(PROBE_SYSTEM).toContain("Never suggest a principle for them");
    expect(probeSystem(story, 1)).toContain("one of your questions must ask for it");
  });

  it("is written only from their words, else left empty", () => {
    expect(WRITE_SYSTEM).toContain("- principle:");
    expect(WRITE_SYSTEM).toContain('leave it as an empty string ""');
    const without = parseWrite(
      JSON.stringify({ title: "T", parts: { principle: "", situation: "S", result: "R" } }),
      story,
    );
    expect(without.parts.principle).toBe("");
    expect(draftText(without.parts, story)).toBe("S\n\nR");
  });

  it("opens the story when there is one", () => {
    const parts = { principle: "I treat a date as a promise.", situation: "S", result: "R" };
    expect(draftText(parts, story).startsWith("I treat a date as a promise.")).toBe(true);
  });

  it("isn't graded as padding, and can lead the second hook", () => {
    expect(gradeSystem(story)).toContain("don't count it as padding");
    expect(gradeSystem(getStoryType("about_me"))).not.toContain("principle or mental model");
    expect(TELL_SYSTEM).toContain("make the second option lead with that principle");
  });
});

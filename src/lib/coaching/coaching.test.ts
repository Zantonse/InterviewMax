import { describe, expect, it } from "vitest";
import { STEP_MODELS } from "@/lib/ai/config";
import { checkGuideline, guidelineBlocks } from "./guidelines";
import { COACHING_TONE_STEPS, parseCoachingStyle, toneLine, withCoachingTone } from "./style";

describe("coaching style", () => {
  it("defaults to balanced, which adds nothing", () => {
    expect(parseCoachingStyle(null)).toBe("balanced");
    expect(parseCoachingStyle("shouty")).toBe("balanced");
    expect(toneLine("balanced")).toBe("");
    expect(withCoachingTone("storyProbe", "SYSTEM", "balanced")).toBe("SYSTEM");
  });

  it("adds one tone line to coaching steps, saying it is tone only", () => {
    const system = withCoachingTone("practiceFeedback", "SYSTEM", "tough_love");
    expect(system).toMatch(/^SYSTEM\n\nCoaching style: tough love\./);
    expect(system).toContain("tone only");
    expect(withCoachingTone("casePractice", undefined, "gentle")).toMatch(
      /^Coaching style: gentle/,
    );
  });

  it("never touches grading or writing steps", () => {
    expect(withCoachingTone("storyGrade", "SYSTEM", "direct")).toBe("SYSTEM");
    expect(withCoachingTone("storyWrite", "SYSTEM", "direct")).toBe("SYSTEM");
    expect(COACHING_TONE_STEPS).not.toContain("storyGrade");
    for (const step of COACHING_TONE_STEPS) expect(STEP_MODELS).toHaveProperty(step);
  });
});

describe("coaching guidelines", () => {
  it("splits a section into paragraphs, bullets and checklists", () => {
    const body =
      "First line\ncontinues here.\n\nSecond paragraph.\n- a bullet\n- another\n- [ ] check one\n- [x] check two";
    expect(guidelineBlocks(body)).toEqual([
      { kind: "paragraph", text: "First line continues here." },
      { kind: "paragraph", text: "Second paragraph." },
      { kind: "bullets", items: ["a bullet", "another"] },
      { kind: "checklist", items: ["check one", "check two"] },
    ]);
    expect(guidelineBlocks("  \n\n")).toEqual([]);
  });

  it("needs a title and keeps sections a sensible size", () => {
    expect(checkGuideline({ title: "  ", body: "x" })).toEqual({
      error: "Give the section a title.",
    });
    expect(checkGuideline({ title: "x".repeat(121), body: "" })).toHaveProperty("error");
    expect(checkGuideline({ title: " Before a call ", body: "- [ ] read\r\n" })).toEqual({
      title: "Before a call",
      body: "- [ ] read",
    });
  });
});

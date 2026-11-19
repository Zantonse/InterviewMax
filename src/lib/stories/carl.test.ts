import { describe, expect, it } from "vitest";
import { foldLegacyRole, parseContent } from "./content";
import { CARL_CRITERIA } from "./grading";
import { WRITE_SYSTEM } from "./prompts";
import { CARL_PARTS, getStoryType, storyParts } from "./story-types";

// Behavioral stories are told as CARL (Craig, 2026-11-19), opened by an optional principle.
describe("CARL stories", () => {
  it("has the principle, then Context, Action, Result, Learning", () => {
    expect(CARL_PARTS.map((p) => p.label)).toEqual([
      "How I think about it",
      "Context",
      "Action",
      "Result",
      "Learning",
    ]);
    expect(storyParts(getStoryType("major_project")).map((p) => p.id)).toEqual([
      "principle",
      "situation",
      "actions",
      "result",
      "reflection",
    ]);
  });

  it("asks the writer for the CARL parts, with no separate role", () => {
    expect(WRITE_SYSTEM).toContain("CARL");
    expect(WRITE_SYSTEM).not.toContain('"role"');
  });

  it("grades in CARL order, with the Learning last", () => {
    expect(CARL_CRITERIA.map((c) => c.label)).toEqual([
      "Context",
      "Action: your part",
      "Action: steps and choices",
      "Result",
      "Learning",
    ]);
  });

  it("folds an older draft's role part into the Context", () => {
    expect(foldLegacyRole({ situation: "We were late.", role: "I led it.", actions: "A" })).toEqual({
      situation: "We were late. I led it.",
      actions: "A",
    });
    expect(foldLegacyRole({ role: "I led it." })).toEqual({ situation: "I led it." });
    const intro = { present: "P", next: "N" };
    expect(foldLegacyRole(intro)).toBe(intro);
    const content = parseContent({
      draft: { parts: { situation: "S.", role: "R.", result: "X" }, untracedNumbers: [] },
    });
    expect(content.draft?.parts).toEqual({ situation: "S. R.", result: "X" });
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { quickChecks } from "@/lib/stories/grading";
import { calibrationReport, referenceGradable, verdict, type ReferenceStory } from "./calibrate";

const { stories } = JSON.parse(readFileSync("scripts/sims/reference/stories.json", "utf8")) as {
  stories: ReferenceStory[];
};

describe("grader calibration", () => {
  it("loads every reference answer as a gradable STAR draft", () => {
    expect(stories.length).toBeGreaterThanOrEqual(10);
    for (const ref of stories) {
      const g = referenceGradable(ref);
      expect(g.storyType?.format).toBe("star");
      expect(Object.keys(g.draft.parts)).toEqual(["situation", "role", "actions", "result", "reflection"]);
      expect(quickChecks(g.draft, g.storyType).length).toBeGreaterThan(0);
    }
  });

  it("counts a planted flaw graded above Not yet as a miss", () => {
    expect(verdict("not_yet", "good_enough")).toBe("miss");
    expect(verdict("strong", "good_enough")).toBe("near");
    expect(verdict("strong", "not_yet")).toBe("miss");
    expect(verdict("good_enough", undefined)).toBe("error");
  });

  it("reports hits and caught flaws per grader", () => {
    const md = calibrationReport([
      { ref: stories[0], results: [{ model: "a/x", tier: "strong", score: 95, criteria: { result: 4 } }] },
      { ref: stories.find((s) => s.kind === "planted")!, results: [{ model: "a/x", tier: "good_enough", score: 80, criteria: {} }] },
    ]);
    expect(md).toContain("a/x: 1/2 on the expected tier, caught 0/1 planted flaws, 1 misses");
  });
});

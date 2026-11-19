import { describe, expect, it } from "vitest";
import { FIELD_IDS } from "@/lib/field/fields";
import { FIELDS_WITH_EXAMPLES, exampleStoryFor } from "./example-ladder";

describe("exampleStoryFor", () => {
  it("has a story for every field, falling back to the general one", () => {
    for (const id of FIELD_IDS) {
      const story = exampleStoryFor(id);
      expect(story.question).toMatch(/\?|\.$/);
      expect(story.levels).toHaveLength(3);
    }
    expect(exampleStoryFor(null)).toBe(exampleStoryFor("generic"));
    expect(exampleStoryFor("other")).toBe(exampleStoryFor("generic"));
  });

  it.each(FIELDS_WITH_EXAMPLES)("%s climbs one idea per level", (id) => {
    const [l1, l2, l3] = exampleStoryFor(id).levels;
    const adds = (level: typeof l1) => level.flatMap((s) => (s.adds ? [s.adds] : []));
    // Level 1 only tells what happened.
    expect(adds(l1)).toEqual([]);
    // Level 2 adds the proof; Level 3 adds the thinking and the lesson.
    expect(new Set(adds(l2))).toEqual(new Set(["stakes", "your part", "a number"]));
    expect(new Set(adds(l3))).toEqual(new Set(["your thinking", "the lesson"]));
    // The same story climbs: everything at Level 2 is still there at Level 3.
    const l3Text = l3.map((s) => s.text);
    for (const s of l2) expect(l3Text).toContain(s.text);
    // Level 2 has a number in it.
    expect(l2.some((s) => s.adds === "a number" && /\d/.test(s.text))).toBe(true);
  });
});

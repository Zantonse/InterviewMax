import { describe, expect, it } from "vitest";
import { cleanOptions } from "./content";
import { quickLine, quickPicked, quickStartRows } from "./quick-start";

describe("quick start rows", () => {
  it("has stakes, part and an ending that fits the story type", () => {
    expect(quickStartRows("major_project").map((r) => r.id)).toEqual(["stakes", "part", "ending"]);
    expect(quickStartRows("went_wrong")[2].options).toContain("I fixed it");
    expect(quickStartRows(null)[2].options).toContain("It worked");
  });

  it("never offers a figure", () => {
    for (const row of quickStartRows("major_project")) {
      expect(cleanOptions(row.options)).toEqual(row.options);
    }
  });

  it("finds the pick in the answer", () => {
    const [stakes] = quickStartRows("major_project");
    const answer = `${quickLine(stakes, "Money")}\nWe were late`;
    expect(quickPicked(stakes, answer)).toBe("Money");
    expect(quickPicked(stakes, "nothing")).toBeUndefined();
  });
});

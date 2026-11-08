import { describe, expect, it } from "vitest";
import { graderTable, type GraderResult } from "./graders";

describe("graderTable", () => {
  it("puts each grader in a column, with failures marked", () => {
    const results: GraderResult[] = [
      { model: "openai/gpt-5.5 (in the app)", tier: "good_enough", score: 75, criteria: {} },
      { model: "deepseek/deepseek-v4.1-flash", tier: "strong", score: 88, criteria: {} },
      { model: "google/gemini-2.5-flash", criteria: {}, error: "bad json" },
    ];
    const table = graderTable([{ persona: "Priya", level: "Senior", results }]);
    expect(table).toContain("| gpt-5.5 (in the app) | deepseek-v4.1-flash | gemini-2.5-flash |");
    expect(table).toContain("| Priya | Senior | good enough, 75 | strong, 88 | failed |");
  });

  it("is empty with no graders", () => {
    expect(graderTable([])).toBe("");
  });
});

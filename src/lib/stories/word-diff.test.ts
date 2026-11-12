import { describe, expect, it } from "vitest";
import { wordDiff } from "./word-diff";

describe("wordDiff", () => {
  it("marks added and cut words and keeps the rest", () => {
    expect(wordDiff("We talked to her a lot.", "I talked to her every morning.")).toEqual([
      { kind: "cut", text: "We" },
      { kind: "added", text: "I" },
      { kind: "same", text: "talked to her" },
      { kind: "cut", text: "a lot." },
      { kind: "added", text: "every morning." },
    ]);
  });

  it("folds a short kept run between two changes into one cut and one addition", () => {
    expect(wordDiff("We talked to her a lot", "I escalated to the CFO")).toEqual([
      { kind: "cut", text: "We talked to her a lot" },
      { kind: "added", text: "I escalated to the CFO" },
    ]);
  });

  it("treats a new part as all added and a removed one as all cut", () => {
    expect(wordDiff("", "I was the PM.")).toEqual([{ kind: "added", text: "I was the PM." }]);
    expect(wordDiff("I was the PM.", "")).toEqual([{ kind: "cut", text: "I was the PM." }]);
    expect(wordDiff("", "")).toEqual([]);
  });

  it("ignores trailing punctuation and case when matching words", () => {
    expect(wordDiff("She signed off.", "she signed off, and we launched.")).toEqual([
      { kind: "same", text: "she signed off," },
      { kind: "added", text: "and we launched." },
    ]);
  });

  it("shows a very long part as replaced instead of diffing it", () => {
    const long = Array.from({ length: 700 }, (_, i) => `w${i}`).join(" ");
    const pieces = wordDiff(long, `${long} more`);
    expect(pieces.map((p) => p.kind)).toEqual(["cut", "added"]);
  });
});


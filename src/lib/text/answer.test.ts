import { describe, expect, it } from "vitest";
import { NO_WORDS_MESSAGE, answerProblem, hasWords, overLimit } from "./answer";

describe("hasWords", () => {
  it("rejects emoji, punctuation and symbols on their own", () => {
    for (const t of ["👍", "🙂🙂 🎉", "...", "?!", "→ ✓", "👨‍👩‍👧"]) expect(hasWords(t)).toBe(false);
  });
  it("accepts any letters or digits, in any script, even with emoji", () => {
    for (const t of ["ok", "42", "我们", "Привет", "shipped it 🚀", "é"]) expect(hasWords(t)).toBe(true);
  });
});

describe("overLimit / answerProblem", () => {
  it("counts trimmed characters over the limit", () => {
    expect(overLimit("abcd", 5)).toBe(0);
    expect(overLimit("  abcdefg  ", 5)).toBe(2);
  });
  it("says how much to trim, then flags no words, else nothing", () => {
    expect(answerProblem("a".repeat(6001), 6000)).toMatch(/1 character over the 6,000 limit/);
    expect(answerProblem("👍", 6000)).toBe(NO_WORDS_MESSAGE);
    expect(answerProblem("", 6000)).toBeNull();
    expect(answerProblem("I led the migration.", 6000)).toBeNull();
  });
});

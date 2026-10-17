import { describe, expect, it } from "vitest";
import { LIBRARY, buildLibrary, questionKey } from "./library";
import { QUESTION_THEMES } from "./themes";

describe("question library", () => {
  it("has every theme's templates and more for each theme, with no repeats", () => {
    for (const theme of QUESTION_THEMES) {
      const own = LIBRARY.filter((q) => q.theme === theme.id).map((q) => q.question);
      expect(own.slice(0, theme.templates.length)).toEqual([...theme.templates]);
      expect(own.length).toBeGreaterThanOrEqual(6);
    }
    const keys = LIBRARY.map((q) => questionKey(q.question));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("puts the user's questions first and merges the same question from several places", () => {
    const entries = buildLibrary({
      jobs: [
        {
          id: "j1",
          title: "PM",
          likelyQuestions: { questions: [{ question: "Tell me about a time you failed.", theme: "failure" }] },
        },
      ],
      transcripts: [
        {
          id: "t1",
          title: "Acme screen",
          asked: [
            { question: "Tell me about a time you failed!", theme: "failure" },
            { question: "Can you code a linked list?", theme: null },
          ],
        },
      ],
    });
    expect(entries[0]).toEqual({
      question: "Tell me about a time you failed.",
      theme: "failure",
      sources: [
        { kind: "job", jobId: "j1", title: "PM" },
        { kind: "transcript", transcriptId: "t1", title: "Acme screen" },
        { kind: "library" },
      ],
    });
    // Questions outside the behavioral themes stay out.
    expect(entries.some((e) => e.question.includes("linked list"))).toBe(false);
    expect(entries).toHaveLength(LIBRARY.length);
  });
});

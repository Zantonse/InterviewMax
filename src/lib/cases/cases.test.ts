import { describe, expect, it } from "vitest";
import type { TranscriptAnalysis } from "@/lib/transcripts/content";
import { caseKind, caseQuestionsFor } from "./content";
import { casePracticeMessages, parseCasePracticeReply } from "./prompts";

function analysis(asked: { question: string; theme: TranscriptAnalysis["asked"][number]["theme"] }[]): TranscriptAnalysis {
  return {
    summary: "",
    lookingFor: [],
    asked: asked.map((a) => ({ ...a, probes: [], landed: "mixed", note: "Stayed general.", evidence: "x", gaps: [] })),
    dropped: 0,
    model: "m",
    analyzedAt: "",
  };
}

describe("case and technical questions", () => {
  it("tells skills questions from case questions", () => {
    expect(caseKind("How do you use SQL in your current role?")).toBe("skill");
    expect(caseKind("Do you have any experience leveraging R, Python or SQL?")).toBe("skill");
    expect(caseKind("We see a correlation between car wash accessories and Coca Cola sales. What does it tell you?")).toBe("case");
    expect(caseKind("How would you approach adding a premium third battery line?")).toBe("case");
  });

  it("takes non-behavioral questions from past interviews, this job's first, and leaves out screening ones", () => {
    const transcripts = [
      {
        id: "t1",
        title: "Elsewhere",
        targetJobId: null,
        company: "Other Co",
        analysis: analysis([{ question: "How would you design a pricing test?", theme: null }]),
      },
      {
        id: "t2",
        title: "Hiring manager",
        targetJobId: "j1",
        company: "AutoZone",
        analysis: analysis([
          { question: "Tell me about yourself.", theme: "about_you" },
          { question: "What does the correlation tell you?", theme: null },
          { question: "Do you have a number you're trying to target?", theme: null },
          { question: "How do you use SQL?", theme: null },
        ]),
      },
      { id: "t3", title: "Not reviewed", targetJobId: "j1", company: "AutoZone", analysis: null },
    ];
    const list = caseQuestionsFor({ id: "j1", company: "AutoZone" }, transcripts);
    expect(list.map((q) => [q.question, q.here, q.kind])).toEqual([
      ["What does the correlation tell you?", true, "case"],
      ["How do you use SQL?", true, "skill"],
      ["How would you design a pricing test?", false, "case"],
    ]);
    expect(list[0]).toMatchObject({ transcriptId: "t2", landed: "mixed", note: "Stayed general." });
  });

  it("sends the frame, the question and the answer", () => {
    const [m] = casePracticeMessages({
      question: "Should we add a premium battery line?",
      kind: "case",
      answer: "I'd look at cannibalization.",
      job: { title: "Merch Analyst", company: "AutoZone" },
    });
    expect(m.content).toContain("Test before betting");
    expect(m.content).toContain("premium battery line");
    expect(m.content).toContain("at AutoZone");
  });

  it("keeps only known steps and drops invented figures", () => {
    const input = { question: "Should we add a premium line?", kind: "case" as const, answer: "I would compare two lines over 3 months." };
    const fb = parseCasePracticeReply(
      JSON.stringify({
        summary: "Good start on trade-offs.",
        covered: ["breakdown", "bogus"],
        missing: [
          { step: "test", tip: "Pilot it in a few stores for 3 months before the chain." },
          { step: "test", tip: "Pilot it in 200 stores." },
          { step: "nope", tip: "Ignored." },
        ],
        followUp: "How would you control for weather?",
      }),
      input,
    );
    expect(fb.covered).toEqual(["breakdown"]);
    expect(fb.missing).toEqual([{ step: "test", tip: "Pilot it in a few stores for 3 months before the chain." }]);
    expect(fb.followUp).toBe("How would you control for weather?");
    expect(() => parseCasePracticeReply("{}", input)).toThrow();
  });
});

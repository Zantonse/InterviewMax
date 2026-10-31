import { describe, expect, it } from "vitest";
import type { AskedQuestion, TranscriptAnalysis } from "./content";
import { buildTimeline, guessRound, interviewersIn, type TimelineTranscript } from "./timeline";

function analysis(summary: string, asked: Partial<AskedQuestion>[]): TranscriptAnalysis {
  return {
    summary,
    lookingFor: [],
    asked: asked.map((q) => ({
      question: "Q",
      theme: null,
      probes: [],
      landed: "strong",
      note: "",
      evidence: "",
      gaps: [],
      ...q,
    })),
    dropped: 0,
    model: "test",
    analyzedAt: "2026-10-01T00:00:00Z",
  };
}

function t(over: Partial<TimelineTranscript>): TimelineTranscript {
  return {
    id: "t",
    targetJobId: "job",
    title: "Interview",
    company: "Acme",
    speaker: "Kevin Law",
    transcript: "",
    analysis: null,
    round: null,
    createdAt: "2026-10-01T00:00:00Z",
    ...over,
  };
}

const JOB = { id: "job", company: "Acme" };

describe("guessing the round", () => {
  it("reads it from the title or summary", () => {
    expect(guessRound("Acme recruiter call")).toBe("recruiter");
    expect(guessRound("Phone screen with Sam")).toBe("recruiter");
    expect(guessRound("Hiring manager - Christopher")).toBe("hiring_manager");
    expect(guessRound("Onsite loop")).toBe("panel");
    expect(guessRound("Panel with 3 directors")).toBe("panel");
    expect(guessRound("Final round with the VP")).toBe("final");
    expect(guessRound("Chat with Adam")).toBeNull();
  });
});

describe("naming the interviewers", () => {
  it("lists speaker labels other than the user's, in order", () => {
    const text =
      "Dana Smith: Hi.\nKevin Law: Hi.\nInterviewer: Hello\nLee: Welcome.\nDana Smith: So.";
    expect(interviewersIn(text, "Kevin Law")).toEqual(["Dana Smith", "Lee"]);
  });

  it("skips lines that aren't speaker labels", () => {
    expect(interviewersIn("note: this was rushed\nMe: Hello", "Me")).toEqual([]);
  });
});

describe("building the timeline", () => {
  it("orders known rounds, keeps unlabelled ones after the step before them", () => {
    const tl = buildTimeline(JOB, [
      t({ id: "panel", title: "Panel", createdAt: "2026-10-01T00:00:00Z" }),
      t({ id: "chat", title: "Chat with Adam", createdAt: "2026-10-02T00:00:00Z" }),
      t({ id: "rec", title: "Talk", round: "recruiter", createdAt: "2026-10-03T00:00:00Z" }),
    ]);
    expect(tl.steps.map((s) => s.transcriptId)).toEqual(["rec", "panel", "chat"]);
    expect(tl.steps[0]).toMatchObject({
      round: "recruiter",
      guessed: false,
      roundLabel: "Recruiter screen",
    });
    expect(tl.steps[1]).toMatchObject({ round: "panel", guessed: true });
    expect(tl.steps[2]).toMatchObject({ round: null, roundLabel: "Round not set" });
    expect(tl.next.label).toBe("Final round");
  });

  it("takes this job's interviews and unlinked ones at the same company only", () => {
    const tl = buildTimeline(JOB, [
      t({ id: "a" }),
      t({ id: "b", targetJobId: null, company: " acme " }),
      t({ id: "c", targetJobId: "other-job", company: "Acme" }),
      t({ id: "d", targetJobId: null, company: "Globex" }),
    ]);
    expect(tl.steps.map((s) => s.transcriptId).sort()).toEqual(["a", "b"]);
  });

  it("lists weak answers before partly landed ones, and themes asked in more than one round", () => {
    const tl = buildTimeline(JOB, [
      t({
        id: "1",
        round: "recruiter",
        analysis: analysis("Screen", [
          { question: "Why us?", theme: "conflict", landed: "mixed" },
          { question: "Tell me about yourself", theme: "about_you", landed: "strong" },
        ]),
      }),
      t({
        id: "2",
        round: "hiring_manager",
        createdAt: "2026-10-05T00:00:00Z",
        analysis: analysis("HM", [
          { question: "A time you failed", theme: "failure", landed: "weak" },
          { question: "Walk me through your background", theme: "about_you", landed: "strong" },
        ]),
      }),
    ]);
    expect(tl.next.label).toBe("Panel or loop");
    expect(tl.next.prepare.map((p) => p.question)).toEqual(["A time you failed", "Why us?"]);
    expect(tl.next.repeated).toEqual(["About you"]);
    expect(tl.steps[1].toFix).toBe(1);
  });

  it("has no next round label after the final round or with no known round", () => {
    expect(buildTimeline(JOB, [t({ round: "final" })]).next.label).toBeNull();
    expect(buildTimeline(JOB, [t({ title: "Chat" })]).next.label).toBeNull();
    expect(buildTimeline(JOB, []).steps).toEqual([]);
  });
});

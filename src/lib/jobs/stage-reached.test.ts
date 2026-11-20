import { describe, expect, it } from "vitest";
import { outcomeSummary } from "./outcome";
import { guessStageReached } from "./stage-guess";
import { isStageReached, jobsMissingStage, stageRank } from "./stage-reached";
import type { TimelineTranscript } from "@/lib/transcripts/timeline";

const job = { id: "j1", company: "Acme", roundName: "" };

function transcript(over: Partial<TimelineTranscript>): TimelineTranscript {
  return {
    id: "t",
    targetJobId: "j1",
    title: "Interview",
    company: "Acme",
    speaker: "Me",
    transcript: "",
    analysis: null,
    round: null,
    createdAt: "2026-11-01T00:00:00Z",
    ...over,
  };
}

describe("stage reached", () => {
  it("accepts only pipeline stages", () => {
    expect(isStageReached("hiring_manager")).toBe(true);
    expect(isStageReached("applied")).toBe(true);
    expect(isStageReached("other")).toBe(false);
    expect(isStageReached("offer")).toBe(false);
    expect(stageRank("applied")).toBeLessThan(stageRank("final"));
  });

  it("guesses the furthest stage from the job's interviews", () => {
    const guess = guessStageReached(job, [
      transcript({ id: "a", round: "recruiter" }),
      transcript({ id: "b", title: "Onsite loop with the team" }),
    ]);
    expect(guess).toEqual({ stage: "panel", from: "transcripts" });
  });

  it("ignores interviews at another company", () => {
    const guess = guessStageReached(job, [
      transcript({ targetJobId: "j2", company: "Other", round: "final" }),
    ]);
    expect(guess).toBeNull();
  });

  it("falls back to the round's name, else no guess", () => {
    expect(guessStageReached({ ...job, roundName: "Hiring manager chat" }, [])).toEqual({
      stage: "hiring_manager",
      from: "round name",
    });
    expect(guessStageReached({ ...job, roundName: "Round two" }, [])).toBeNull();
    expect(guessStageReached(job, [])).toBeNull();
  });

  it("asks only about finished, non-offer jobs with no stage", () => {
    const jobs = [
      { id: "open", outcome: null, stageReached: null },
      { id: "offer", outcome: "offer", stageReached: null },
      { id: "set", outcome: "rejected", stageReached: "panel" as const },
      { id: "missing", outcome: "rejected", stageReached: null },
      { id: "withdrew", outcome: "withdrew", stageReached: null },
    ];
    expect(jobsMissingStage(jobs).map((j) => j.id)).toEqual(["missing", "withdrew"]);
  });

  it("names the stage in the outcome summary", () => {
    expect(
      outcomeSummary({
        outcome: "rejected",
        roundReached: 2,
        roundName: "",
        stageReached: "hiring_manager",
      }),
    ).toBe("Not selected · ended at Hiring manager · round 2");
    expect(
      outcomeSummary({ outcome: "rejected", roundReached: null, roundName: "", stageReached: "final" }),
    ).toBe("Not selected · ended at Final round");
    // An offer got past every stage, so a stale stage isn't shown.
    expect(
      outcomeSummary({ outcome: "offer", roundReached: 4, roundName: "", stageReached: "panel" }),
    ).toBe("Offer · reached round 4");
  });
});

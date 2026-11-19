import { describe, expect, it } from "vitest";
import type { AskedQuestion, TranscriptAnalysis } from "./content";
import { buildInterviewProfile, profileMoves, scoreInterview, type ProfileTranscript } from "./profile";

const asked = (q: Partial<AskedQuestion> & { question: string }): AskedQuestion => ({
  theme: "impact",
  probes: [],
  landed: "mixed",
  note: "",
  evidence: "",
  gaps: [],
  ...q,
});

const analysis = (list: AskedQuestion[]): TranscriptAnalysis => ({
  summary: "",
  lookingFor: [],
  asked: list,
  dropped: 0,
  model: "t",
  analyzedAt: "2026-10-17T00:00:00Z",
});

const interview = (id: string, day: string, list: AskedQuestion[], extra: Partial<ProfileTranscript> = {}) => ({
  id,
  title: `Interview ${id}`,
  targetJobId: "j1",
  analysis: analysis(list),
  createdAt: `2026-10-${day}T00:00:00Z`,
  ...extra,
});

// 60 words per answer turn, with a set number of hedges in each.
function labelled(hedgesPerTurn: number, turns = 6): string {
  const filler = Array.from({ length: 60 - hedgesPerTurn * 2 }, (_, i) => `word${i}`).join(" ");
  const hedges = Array.from({ length: hedgesPerTurn }, () => "I think").join(" ");
  return Array.from({ length: turns }, () => `Interviewer: Tell me more.\n\nMe: ${hedges} ${filler}.`).join("\n\n");
}

// Kevin-shaped (tester data, Oct 17): answers that stop before the result in several interviews,
// "I would" instead of a real example, one strong stakeholder story.
const kevin: ProfileTranscript[] = [
  interview("bcu1", "10", [
    asked({ question: "How would you move us from gut to data?", gaps: ["example", "result"], landed: "weak", evidence: "I would start by", note: "Stayed hypothetical." }),
    asked({ question: "Tell me about an insight management acted on.", gaps: ["result"], landed: "mixed", evidence: "we reran the reports" }),
    asked({ question: "Is 30% travel OK?", theme: null, landed: "strong" }),
  ]),
  interview("bcu2", "11", [
    asked({ question: "Tell me about cross-functional alignment.", theme: "influence", landed: "strong", evidence: "the approver only wanted a heads-up email" }),
    asked({ question: "What actually changed in the numbers?", gaps: ["result", "numbers"], landed: "weak", evidence: "it was more consistent" }),
    asked({ question: "Tell me about a disagreement with a senior leader.", theme: "influence", landed: "strong", evidence: "I showed the documents" }),
  ]),
  interview("az1", "12", [
    asked({ question: "Tell me about a time you used data analysis.", gaps: ["result", "example"], landed: "mixed", evidence: "it depends on the audience" }),
    asked({ question: "How do you use SQL day to day?", theme: null, landed: "weak", note: "Called his SQL moderate at best." }),
    asked({ question: "Should the battery category add a premium line?", theme: null, landed: "mixed" }),
  ]),
];

describe("scoreInterview", () => {
  it("leaves logistics questions out and counts how answers landed", () => {
    const s = scoreInterview(kevin[0]);
    expect(s.judged).toBe(2);
    expect(s.landed).toBe(0);
    expect(s.gaps[0]).toEqual({ gap: "result", count: 2 });
  });

  it("counts hedges in the user's own words", () => {
    const s = scoreInterview({ ...kevin[0], transcript: labelled(2), speaker: "Me" });
    expect(s.hedges).toBeGreaterThan(3);
  });
});

describe("buildInterviewProfile", () => {
  const p = buildInterviewProfile(kevin);

  it("scores every reviewed interview, oldest first", () => {
    expect(p.interviews).toBe(3);
    expect(p.scores.map((s) => s.id)).toEqual(["bcu1", "bcu2", "az1"]);
    expect(p.answers).toBe(8);
    expect(p.landed).toBe(25);
  });

  it("leads weaknesses with the habit seen across interviews, quoting it", () => {
    expect(p.weaknesses[0].id).toBe("gap-result");
    expect(p.weaknesses[0].detail).toContain("in 3 interviews");
    expect(p.weaknesses[0].citation?.quote).toBeTruthy();
    expect(p.weaknesses.map((w) => w.id)).toEqual(["gap-result", "theme-impact", "cases"]);
  });

  it("finds the theme that keeps landing as a strength", () => {
    expect(p.strengths.map((s) => s.id)).toContain("theme-influence");
    const s = p.strengths.find((x) => x.id === "theme-influence")!;
    expect(s.citation?.quote).toBe("the approver only wanted a heads-up email");
  });

  it("quotes only the transcript, keeping the review's note apart", () => {
    const cases = p.weaknesses.find((w) => w.id === "cases")!;
    expect(cases.note).toBe("Called his SQL moderate at best.");
    expect(cases.citation?.quote).toBeUndefined();
  });

  it("never calls a gap a strength when answers keep missing it", () => {
    expect(p.strengths.map((s) => s.id)).not.toContain("gap-result");
  });

  it("turns weaknesses into steps, each place named once", () => {
    expect(p.workOn.length).toBeGreaterThan(0);
    expect(p.workOn.length).toBeLessThanOrEqual(3);
    const keys = p.workOn.map((w) => w.next.storyType ?? w.next.href);
    expect(new Set(keys).size).toBe(keys.length);
    expect(p.workOn[0].next.href).toBe("/numbers");
  });

  it("calls out heavy hedging, and sounding sure as a strength", () => {
    const unsure = buildInterviewProfile(kevin.map((t) => ({ ...t, transcript: labelled(2), speaker: "Me" })));
    expect(unsure.weaknesses.map((w) => w.id)).toContain("hedging");
    const sure = buildInterviewProfile(kevin.map((t) => ({ ...t, transcript: labelled(0), speaker: "Me" })));
    expect(sure.strengths.map((s) => s.id)).toContain("sure");
  });

  it("is empty with nothing reviewed", () => {
    const empty = buildInterviewProfile([{ id: "x", title: "x", targetJobId: null, analysis: null }]);
    expect(empty).toMatchObject({ interviews: 0, answers: 0, landed: null, strengths: [], weaknesses: [], workOn: [] });
  });
});

describe("profileMoves", () => {
  it("says nothing for the first interview", () => {
    expect(profileMoves(kevin, "bcu1")).toEqual([]);
  });

  it("compares a new interview with the ones before it", () => {
    const better = interview("new", "20", [
      asked({ question: "Tell me about a project you led.", landed: "strong", evidence: "cut close time by 3 days" }),
      asked({ question: "Tell me about a hard trade-off.", theme: "prioritization", landed: "strong" }),
    ]);
    const moves = profileMoves([...kevin, better], "new");
    expect(moves[0]).toMatchObject({ direction: "up" });
    expect(moves[0].text).toContain("100%");
    expect(moves.some((m) => m.text.includes("answers stop before the result"))).toBe(true);
  });

  it("flags a missing piece seen for the first time", () => {
    const worse = interview("new", "20", [
      asked({ question: "Tell me about a project.", gaps: ["concise"], landed: "weak" }),
    ]);
    const moves = profileMoves([...kevin, worse], "new");
    expect(moves.some((m) => m.direction === "down" && m.text.startsWith("New this time"))).toBe(true);
  });
});

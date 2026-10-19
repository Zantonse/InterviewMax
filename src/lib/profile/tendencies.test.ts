import { describe, expect, it } from "vitest";
import type { AskedQuestion, TranscriptAnalysis } from "@/lib/transcripts/content";
import { assessProfile, type ProfileInput } from "./assess";
import { interviewTendencies, type TendencyTranscript } from "./tendencies";

const WRITTEN = "2026-10-16T00:00:00Z";

const asked = (q: Partial<AskedQuestion> & { question: string }): AskedQuestion => ({
  theme: null,
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
  analyzedAt: WRITTEN,
});

// 60 words per answer turn, with a set number of hedges in each.
function labelled(hedgesPerTurn: number, turns = 6): string {
  const filler = Array.from({ length: 60 - hedgesPerTurn * 2 }, (_, i) => `word${i}`).join(" ");
  const hedges = Array.from({ length: hedgesPerTurn }, () => "I think").join(" ");
  return Array.from({ length: turns }, () => `Interviewer: Tell me more.\n\nMe: ${hedges} ${filler}.`).join("\n\n");
}

const transcript = (over: Partial<TendencyTranscript>): TendencyTranscript => ({
  id: "t1",
  title: "BCU · Panel",
  targetJobId: "j1",
  analysis: null,
  ...over,
});

const byId = (list: ReturnType<typeof interviewTendencies>, id: string) => list.find((t) => t.id === id)!;

describe("interviewTendencies", () => {
  it("has nothing to say with no past interviews", () => {
    const list = interviewTendencies([]);
    expect(list.map((t) => t.status)).toEqual(["no_data", "no_data", "no_data", "no_data", "no_data"]);
  });

  it("counts hedges across interviews and shows the change when they were added on different days", () => {
    const list = interviewTendencies([
      transcript({ id: "a", title: "First", transcript: labelled(2), speaker: "Me", createdAt: "2026-10-01T00:00:00Z" }),
      transcript({ id: "b", title: "Latest", transcript: labelled(0), speaker: "Me", createdAt: "2026-10-10T00:00:00Z" }),
    ]);
    const sure = byId(list, "sure");
    expect(sure.headline).toBe("1.7 hedges per 100 words across 2 interviews.");
    expect(sure.status).toBe("weak");
    expect(sure.details[0]).toBe("Down from 3.3 to 0 per 100 words since your first one");
    expect(sure.citations[0]).toMatchObject({ href: "/transcripts/a" });
  });

  it("doesn't read a trend into interviews uploaded together", () => {
    const sure = byId(
      interviewTendencies([
        transcript({ id: "a", transcript: labelled(2), speaker: "Me", createdAt: "2026-10-17T01:00:00Z" }),
        transcript({ id: "b", transcript: labelled(0), speaker: "Me", createdAt: "2026-10-17T02:00:00Z" }),
      ]),
      "sure",
    );
    expect(sure.details.some((d) => d.startsWith("Down"))).toBe(false);
  });

  it("counts answers without a result, the pushes for one, and general answers", () => {
    const list = interviewTendencies([
      transcript({
        analysis: analysis([
          asked({
            question: "Tell me about a time you changed reporting.",
            theme: "impact",
            probes: ["What actually changed?", "So what changed in the numbers?", "Who uses it?"],
            gaps: ["result"],
            evidence: "we reran the reports",
          }),
          asked({ question: "How do you move a team to data?", theme: "influence", gaps: ["example"], evidence: "I would start by listening" }),
          asked({ question: "A cross-team win?", theme: "influence", landed: "strong", evidence: "the approver only wanted a heads-up email" }),
        ]),
      }),
    ]);
    const result = byId(list, "result");
    expect(result.headline).toBe("2 of 3 story answers reached a clear result.");
    expect(result.details).toEqual(["Interviewers asked for the outcome 2 times on 1 answer"]);
    expect(result.citations[0].quote).toBe("What actually changed?");
    const example = byId(list, "example");
    expect(example.headline).toBe("1 story answer of 3 stayed general or said what you would do.");
    expect(example.citations[0].quote).toBe("I would start by listening");
    const landed = byId(list, "landed");
    expect(landed.citations[0].quote).toBe("the approver only wanted a heads-up email");
  });

  it("lists the skills interviewers tested and how those answers went", () => {
    const list = interviewTendencies([
      transcript({
        id: "a",
        analysis: analysis([
          asked({ question: "What's your SQL level?", landed: "weak", note: "Called it moderate at best." }),
          asked({ question: "Should batteries add a premium line?", landed: "mixed" }),
          asked({ question: "What number are you targeting?" }),
        ]),
      }),
      transcript({ id: "b", analysis: analysis([asked({ question: "How do you use SQL day to day?", landed: "weak" })]) }),
    ]);
    const tested = byId(list, "tested");
    expect(tested.headline).toBe("3 case or skills questions, 0 landed well.");
    expect(tested.details).toEqual(["SQL came up in 2 of 2 interviews", "1 case question to reason through"]);
    expect(tested.status).toBe("weak");
    expect(tested.citations[0]).toMatchObject({ href: "/transcripts/a", quote: "Called it moderate at best." });
    expect(tested.next?.href).toBe("/jobs/j1#cases");
  });
});

describe("assessProfile with tendencies", () => {
  const none: ProfileInput = { stories: [], jobs: [], numbers: null, transcripts: [], practice: [], assessment: null };

  it("turns heavy hedging and weak skills answers into weaknesses", () => {
    const result = assessProfile({
      ...none,
      transcripts: [
        {
          id: "a",
          title: "AutoZone · Hiring manager",
          targetJobId: "j1",
          transcript: labelled(2),
          speaker: "Me",
          analysis: analysis([asked({ question: "What's your SQL level?", landed: "weak", note: "Undersold it." })]),
        },
      ],
    });
    expect(result.tendencies).toHaveLength(5);
    const texts = result.weaknesses.map((w) => w.text);
    expect(texts).toContain("You hedge a lot in real interviews: 3.3 hedges per 100 words across 1 interview.");
    expect(texts).toContain("Case and skills questions are a weak spot: 1 case or skills question, 0 landed well.");
  });
});

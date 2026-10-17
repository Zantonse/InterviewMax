import { describe, expect, it } from "vitest";
import type { PracticeItem } from "@/lib/practice/content";
import { emptyContent, type StoryContent } from "@/lib/stories/content";
import type { StoryGrade } from "@/lib/stories/grading";
import type { TranscriptAnalysis } from "@/lib/transcripts/content";
import { assessProfile, jobReadiness, resultFigure, type ProfileInput } from "./assess";
import {
  changesSince,
  factsBasis,
  parseStoredProfile,
  recordVisit,
  snapshotOf,
  summaryFacts,
} from "./content";
import { checkSummary, fallbackSummary, parseProfileSummary } from "./prompts";

const WRITTEN = "2026-10-16T00:00:00Z";

function drafted(result: string, grade?: Partial<StoryGrade>, untraced: string[] = []): StoryContent {
  return {
    ...emptyContent(),
    answers: { start: result },
    followUps: [],
    draft: { parts: { situation: "S", result }, untracedNumbers: untraced, model: "test", writtenAt: WRITTEN },
    ...(grade
      ? {
          grade: {
            tier: "good_enough",
            fixes: [],
            strengths: [],
            criteria: [],
            checks: [],
            flags: [],
            model: "test",
            draftWrittenAt: WRITTEN,
            gradedAt: WRITTEN,
            ...grade,
          },
        }
      : {}),
  } as StoryContent;
}

const scores = (s: Record<string, number>) =>
  Object.entries(s).map(([id, score]) => ({ id, score, note: `${id} note.`, improve: `Raise ${id}.` }));

const story = (id: string, storyType: string, content: StoryContent) => ({ id, title: id, storyType, content });

const job = (id: string, themes: string[], level: string | null = "senior") => ({
  id,
  title: `Job ${id}`,
  company: "Acme",
  level,
  likelyQuestions: {
    questions: themes.map((theme, i) => ({
      question: `Question ${i} about ${theme}?`,
      theme: theme as never,
      why: "",
      source: "common" as const,
      specific: false,
    })),
  },
});

const none: ProfileInput = {
  stories: [],
  jobs: [],
  numbers: null,
  transcripts: [],
  practice: [],
  assessment: null,
};

describe("assessProfile", () => {
  it("is empty with nothing written, and every criterion but coverage has no data", () => {
    const result = assessProfile(none);
    expect(result.empty).toBe(true);
    expect(result.criteria).toHaveLength(8);
    expect(result.criteria.filter((c) => c.status !== "no_data").map((c) => c.id)).toEqual(["coverage"]);
    expect(result.strengths).toEqual([]);
    // Missing themes are a weakness with a button to build the story.
    expect(result.weaknesses[0]).toMatchObject({ criterion: "coverage", next: { storyType: expect.any(String) } });
  });

  it("averages grades per STAR criterion and cites the weakest story", () => {
    const result = assessProfile({
      ...none,
      stories: [
        story("a", "major_project", drafted("Saved $2M.", { criteria: scores({ context: 4, result: 2 }) })),
        story("b", "went_wrong", drafted("Cut churn 10%.", { criteria: scores({ context: 4, result: 1 }) })),
      ],
    });
    const craft = result.criteria.find((c) => c.id === "craft")!;
    expect(craft.headline).toBe("Strongest on context (4 of 4), weakest on result (1.5 of 4).");
    expect(craft.status).toBe("developing");
    const weakness = result.weaknesses.find((w) => w.criterion === "craft")!;
    expect(weakness.citation).toMatchObject({ href: "/stories/b", quote: "Raise result." });
    expect(weakness.next).toMatchObject({ href: "/stories/b" });
    expect(result.strengths.find((s) => s.criterion === "craft")?.text).toContain("context");
  });

  it("counts stories that end on a traced number", () => {
    const result = assessProfile({
      ...none,
      stories: [
        story("a", "major_project", drafted("Revenue grew 40%.")),
        story("b", "cross_team", drafted("It went well.")),
        story("c", "prioritization", drafted("Saved 3 weeks.", undefined, ["3"])),
      ],
    });
    const evidence = result.criteria.find((c) => c.id === "evidence")!;
    expect(evidence.headline).toBe("1 of 3 stories end on a traced number.");
    expect(result.weaknesses.find((w) => w.criterion === "evidence")?.next?.label).toBe("Add a number");
  });

  it("ignores years when looking for a result's number", () => {
    expect(resultFigure(story("a", "major_project", drafted("In 2024 it shipped.")))).toBeUndefined();
    expect(resultFigure(story("a", "major_project", drafted("In 2024 it saved $1.2M.")))).toBe("$1.2M");
  });

  it("reads job fit from each story's content check", () => {
    const fit = (jobId: string, level: "strong" | "partial" | "weak") => ({
      jobId,
      title: "",
      company: "",
      fit: level,
      proves: [`Proves for ${jobId}`],
      misses: [`Misses for ${jobId}`],
      answers: [],
    });
    const result = assessProfile({
      ...none,
      jobs: [job("j1", ["impact"]), job("j2", ["conflict"])],
      stories: [
        story("a", "major_project", drafted("Grew 40%.", { content: { jobs: [fit("j1", "strong"), fit("j2", "weak")], unused: [], model: "t" } })),
      ],
    });
    const criterion = result.criteria.find((c) => c.id === "fit")!;
    expect(criterion.headline).toBe("Best fit: Job j1. Weakest: Job j2.");
    expect(result.strengths.find((s) => s.criterion === "fit")?.citation.quote).toBe("Proves for j1");
    expect(result.weaknesses.find((w) => w.criterion === "fit")?.citation.quote).toBe("Misses for j2");
  });

  it("finds recurring gaps in past interviews and quotes them", () => {
    const analysis: TranscriptAnalysis = {
      summary: "",
      lookingFor: [],
      asked: [
        { question: "Tell me about a failure.", theme: "failure", probes: ["What did you learn?"], landed: "weak", note: "", evidence: "we kind of fixed it", gaps: ["result"] },
        { question: "A conflict?", theme: "conflict", probes: [], landed: "mixed", note: "", evidence: "it worked out", gaps: ["result"] },
        { question: "Proudest win?", theme: "impact", probes: [], landed: "strong", note: "", evidence: "I grew it 40%", gaps: [] },
      ],
      dropped: 0,
      model: "t",
      analyzedAt: WRITTEN,
    };
    const result = assessProfile({ ...none, transcripts: [{ id: "t1", title: "Acme screen", targetJobId: null, analysis }] });
    const patterns = result.criteria.find((c) => c.id === "patterns")!;
    expect(patterns.headline).toBe("1 of 3 answers landed well across 1 interview.");
    const weakness = result.weaknesses.find((w) => w.criterion === "patterns")!;
    expect(weakness.text).toBe("In real interviews, 2 answers missed a clear result.");
    expect(weakness.citation).toMatchObject({ href: "/transcripts/t1", quote: "we kind of fixed it" });
    expect(result.strengths.find((s) => s.criterion === "patterns")?.citation.quote).toBe("I grew it 40%");
  });

  it("flags practice answers that run long", () => {
    const item = (seconds: number): PracticeItem => ({
      question: "Tell me about a project.",
      theme: "impact",
      reason: "strong",
      turns: [{ question: "Tell me about a project.", answer: "…" }],
      feedback: {
        summary: "",
        closeness: "close",
        closenessNote: "",
        landed: [],
        missing: [],
        followUpsNote: "Held up under the follow-up.",
        numbersLeftOut: [],
        timing: { seconds, measured: true, words: 300, min: 72, max: 120 },
        newFacts: [],
        model: "t",
        givenAt: WRITTEN,
      },
    });
    const result = assessProfile({ ...none, practice: [{ id: "p", targetJobId: "j1", items: [item(200), item(100)] }] });
    const delivery = result.criteria.find((c) => c.id === "delivery")!;
    expect(delivery.headline).toBe("1 of 2 practice answers at the right length.");
    expect(result.weaknesses.find((w) => w.criterion === "delivery")?.next).toMatchObject({
      label: "Practice that question",
      href: "/jobs/j1/practice",
    });
  });

  it("uses the journey check for readiness", () => {
    const result = assessProfile({
      ...none,
      assessment: {
        answers: { stage: "panels", nextInterview: "soon", targetJob: "posting", stories: "some", aboutMe: "yes" },
        completedAt: WRITTEN,
      },
    });
    expect(result.criteria.find((c) => c.id === "readiness")).toMatchObject({ status: "strong", score: 85 });
  });
});

describe("jobReadiness", () => {
  it("is not ready before questions are predicted", () => {
    expect(jobReadiness({ ...job("j", []), likelyQuestions: null }, []).label).toBe("not_ready");
  });

  it("is ready when most questions have a solid story and the level is met", () => {
    const strong = (id: string, type: string, role: string) =>
      story(id, type, drafted("Grew 40%.", { tier: "strong", bankRole: { role, note: "" } }));
    const stories = [
      strong("a", "major_project", "organization-level impact"),
      strong("b", "difficult_stakeholder", "team-level impact"),
      strong("c", "went_wrong", "team-level impact"),
    ];
    expect(jobReadiness(job("j", ["impact", "conflict", "failure"]), stories).label).toBe("ready");
    // Half the questions covered: getting there.
    expect(jobReadiness(job("j", ["impact", "collaboration"], "mid"), stories.slice(0, 1)).label).toBe("getting_there");
  });
});

describe("stored profile", () => {
  const result = assessProfile(none);

  it("keeps the old baseline when nothing moved, and moves it when something did", () => {
    const first = recordVisit({}, snapshotOf(result, "2026-10-15T00:00:00Z"));
    expect(first.changed).toBe(true);
    const again = recordVisit(first.stored, snapshotOf(result, "2026-10-16T00:00:00Z"));
    expect(again.changed).toBe(false);

    const moved = snapshotOf(result, "2026-10-17T00:00:00Z");
    moved.criteria.coverage = { status: "developing", score: 50 };
    moved.jobs.j1 = { title: "PM", label: "getting_there" };
    const third = recordVisit(again.stored, moved);
    expect(third.stored.previous?.at).toBe("2026-10-15T00:00:00Z");
    expect(changesSince(third.stored.previous, third.stored.latest!)).toEqual([
      { text: "Theme coverage: needs work → developing", direction: "up" },
      { text: "PM: added, getting there", direction: "new" },
    ]);
  });

  it("round-trips through jsonb", () => {
    const stored = { latest: snapshotOf(result, WRITTEN), summary: { text: "Hi", basis: "b", model: "m", writtenAt: WRITTEN } };
    expect(parseStoredProfile(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
    expect(parseStoredProfile("nope")).toEqual({});
  });

  it("hashes the facts, so a change in results makes the summary stale", () => {
    const facts = summaryFacts(result);
    expect(factsBasis(facts)).toBe(factsBasis(facts));
    expect(factsBasis(facts)).not.toBe(factsBasis(`${facts}.`));
  });
});

describe("summary", () => {
  it("keeps only figures that are in the facts", () => {
    const facts = "Evidence: 2 of 3 stories end on a traced number.";
    expect(checkSummary("Two of your 3 stories land on a number.", facts)).toBe(true);
    expect(checkSummary("You grew revenue 40%.", facts)).toBe(false);
    expect(checkSummary("", facts)).toBe(false);
  });

  it("reads the model's JSON", () => {
    expect(parseProfileSummary('Sure: {"summary": " You are close. "}')).toBe("You are close.");
    expect(parseProfileSummary("no json")).toBe("");
  });

  it("falls back to a summary written in code", () => {
    expect(fallbackSummary(assessProfile(none))).toContain("first story");
  });
});

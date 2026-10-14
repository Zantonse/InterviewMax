import { describe, expect, it } from "vitest";
import { levelMix, needLabel, targetLevel, themeCoverage } from "./bank";
import { emptyContent, type StoryContent } from "./content";
import type { StoryGrade } from "./grading";

const DRAFT = {
  text: "A story.",
  parts: {},
  untracedNumbers: [],
  model: "test",
  writtenAt: "2026-10-14T00:00:00Z",
};

function drafted(grade?: Partial<StoryGrade>): StoryContent {
  return {
    ...emptyContent(),
    imported: { text: "My answers", fileName: "" },
    followUps: [],
    draft: DRAFT,
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
            draftWrittenAt: DRAFT.writtenAt,
            gradedAt: DRAFT.writtenAt,
            ...grade,
          },
        }
      : {}),
  } as StoryContent;
}

const story = (id: string, storyType: string, content = emptyContent()) => ({
  id,
  title: id,
  storyType,
  content,
});

describe("themeCoverage", () => {
  it("marks every theme empty with no stories, naming the type to build", () => {
    const themes = themeCoverage([]);
    expect(themes).toHaveLength(10);
    expect(themes.every((t) => t.status === "empty")).toBe(true);
    expect(themes.find((t) => t.id === "conflict")?.build).toBe("difficult_stakeholder");
  });

  it("covers each theme a story type answers, using the best story", () => {
    const themes = themeCoverage([
      story("wip", "major_project"),
      story("best", "major_project", drafted({ tier: "strong" })),
    ]);
    const impact = themes.find((t) => t.id === "impact");
    expect(impact).toMatchObject({ status: "strong", story: { id: "best" } });
    expect(themes.find((t) => t.id === "ownership")?.status).toBe("strong");
    expect(themes.find((t) => t.id === "conflict")?.status).toBe("empty");
  });

  it("treats a stale grade as written, and an unfinished story as in progress", () => {
    const stale = drafted({ tier: "strong", draftWrittenAt: "earlier" });
    const themes = themeCoverage([story("a", "went_wrong", stale), story("b", "cross_team")]);
    expect(themes.find((t) => t.id === "failure")?.status).toBe("written");
    expect(themeCoverage([story("c", "went_wrong", drafted({ tier: "not_yet" }))])[5].status).toBe("not_yet");
    expect(themes.find((t) => t.id === "collaboration")?.status).toBe("in_progress");
  });

  it("keeps a drafted story counted while it has unanswered make-it-stronger questions", () => {
    const strengthening = {
      ...drafted({ tier: "strong" }),
      followUps: [{ question: "How many people?", gap: "result", round: 2 }],
    } as StoryContent;
    const themes = themeCoverage([story("a", "major_project", strengthening)]);
    expect(themes.find((t) => t.id === "impact")?.status).toBe("strong");
  });
});

describe("levelMix", () => {
  const bank = [
    story("a", "major_project", drafted({ bankRole: { role: "organization-level impact", note: "" } })),
    story("b", "cross_team", drafted({ bankRole: { role: "team-level impact", note: "" } })),
    story("c", "went_wrong", drafted({ bankRole: { role: "hands-on proof", note: "" } })),
    story("d", "prioritization", drafted()),
    story("e", "about_me", drafted()),
  ];

  it("counts graded stories by role, and higher scopes toward lower needs", () => {
    const mix = levelMix(bank, "principal");
    expect(mix.counts).toEqual({
      "hands-on proof": 1,
      "team-level impact": 1,
      "organization-level impact": 1,
    });
    expect(mix.ungraded).toBe(1);
    expect(mix.needs).toEqual([
      { role: "organization-level impact", needed: 2, have: 1 },
      { role: "team-level impact", needed: 3, have: 2 },
    ]);
    expect(needLabel(mix.needs[0])).toBe("one organization-level story, two needed");
    expect(needLabel(mix.needs[1])).toBe("two team-level or above stories, three needed");
  });

  it("never asks for hands-on stories, and needs nothing without a level", () => {
    expect(levelMix(bank, undefined).needs).toEqual([]);
    expect(levelMix(bank, "mid").needs.map((n) => n.role)).not.toContain("hands-on proof");
  });
});

describe("targetLevel", () => {
  it("picks the highest level among the jobs", () => {
    expect(targetLevel([{ level: "mid" }, { level: "senior" }])).toBe("senior");
    expect(targetLevel([{ level: null }])).toBeUndefined();
  });
});

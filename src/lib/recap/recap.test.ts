import { describe, expect, it } from "vitest";
import { emptyContent, type StoryContent } from "@/lib/stories/content";
import type { StoryGrade } from "@/lib/stories/grading";
import { buildRecap, recapText } from "./recap";

const WRITTEN = "2026-11-01T00:00:00Z";

function drafted(tier?: StoryGrade["tier"]): StoryContent {
  return {
    ...emptyContent(),
    draft: { parts: {}, untracedNumbers: [], model: "t", writtenAt: WRITTEN },
    ...(tier
      ? {
          grade: {
            tier,
            fixes: [],
            strengths: [],
            criteria: [],
            checks: [],
            flags: [],
            model: "t",
            draftWrittenAt: WRITTEN,
            gradedAt: WRITTEN,
          },
        }
      : {}),
  } as StoryContent;
}

const story = (id: string, storyType: string, content: StoryContent) => ({
  id,
  title: `Story ${id}`,
  storyType,
  content,
});

describe("buildRecap", () => {
  it("is null until a behavioral story is written", () => {
    expect(buildRecap([story("me", "about_me", drafted())], [])).toBeNull();
    expect(buildRecap([story("a", "difficult_stakeholder", emptyContent())], [])).toBeNull();
  });

  it("names the bank by the theme most stories answer, with the numbers and the best story", () => {
    const recap = buildRecap(
      [
        story("me", "about_me", drafted("strong")),
        story("a", "difficult_stakeholder", drafted("good_enough")),
        story("b", "difficult_stakeholder", drafted("not_yet")),
        story("c", "prioritization", drafted()),
      ],
      [{ items: [{ question: "Q", theme: "conflict", reason: "strong", turns: [], feedback: {} as never }] }],
    );
    // difficult_stakeholder answers conflict and influence; conflict comes first in theme order.
    expect(recap?.name).toBe("Peacemaker");
    expect(recap?.stats.map((s) => s.value)).toEqual([4, 1, 1]);
    expect(recap?.best).toEqual({ title: "Story a", level: 2 });
    expect(recap?.nextGap).toBe("Impact and results");
    expect(recapText(recap!)).toContain("Best story: Story a (Level 2)");
  });
});

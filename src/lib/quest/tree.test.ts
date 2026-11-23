import { describe, expect, it } from "vitest";
import { skillsMap } from "@/lib/stories/skills";
import { practiced, story } from "./test-fixtures";
import { aloudLevel, interviewReady, skillTree } from "./tree";

describe("saying it out loud", () => {
  it("climbs with practice, Level 4 stories and a boss round", () => {
    expect(aloudLevel({ practicedAny: false, storiesAtFour: 0, bossRounds: 0 })).toBe(0);
    expect(aloudLevel({ practicedAny: true, storiesAtFour: 0, bossRounds: 0 })).toBe(1);
    expect(aloudLevel({ practicedAny: true, storiesAtFour: 1, bossRounds: 0 })).toBe(2);
    expect(aloudLevel({ practicedAny: true, storiesAtFour: 2, bossRounds: 0 })).toBe(3);
    expect(aloudLevel({ practicedAny: true, storiesAtFour: 2, bossRounds: 1 })).toBe(4);
    expect(aloudLevel({ practicedAny: true, storiesAtFour: 6, bossRounds: 0 })).toBe(3);
    expect(aloudLevel({ practicedAny: true, storiesAtFour: 6, bossRounds: 1 })).toBe(5);
  });
});

describe("skill tree", () => {
  it("has the six story skills and the speaking branch", () => {
    const stories = [story("a", 3)];
    const tree = skillTree({
      map: skillsMap(stories),
      sessions: [{ targetJobId: "j", items: [practiced("a")] }],
      storiesAtFour: 1,
    });
    expect(tree.map((b) => b.id)).toEqual([
      "stakes",
      "ownership",
      "decisions",
      "result",
      "thinking",
      "lesson",
      "aloud",
    ]);
    expect(tree.every((b) => b.steps.length === 5)).toBe(true);
    expect(tree.find((b) => b.id === "aloud")?.level).toBe(2);
    expect(tree.find((b) => b.id === "stakes")?.level).toBe(2);
    expect(interviewReady(tree)).toBe(false);
  });

  it("says what's next for the speaking branch", () => {
    const tree = skillTree({ map: skillsMap([]), sessions: [], storiesAtFour: 0 });
    expect(tree.find((b) => b.id === "aloud")?.next).toBe(
      "Practice an answer out loud and get feedback.",
    );
  });
});

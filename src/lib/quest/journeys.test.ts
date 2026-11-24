import { describe, expect, it } from "vitest";
import { skillsMap } from "@/lib/stories/skills";
import { coreSixJourney, firstStoryJourney, focusStory, weakestSkillJourney } from "./journeys";
import { story } from "./test-fixtures";

const states = (j: ReturnType<typeof firstStoryJourney>) => j.steps.map((s) => s.state);

describe("your first story", () => {
  it("starts at picking a question", () => {
    const j = firstStoryJourney([], new Set());
    expect(states(j)).toEqual(["now", "locked", "locked", "locked", "locked"]);
    expect(j.next).toEqual({ href: "/stories/new", label: "Pick a question to start" });
    expect(j.done).toBe(false);
  });

  it("works on the story furthest along, newest on a tie", () => {
    const stories = [
      story("old", 2, { updatedAt: "2026-11-01" }),
      story("newest", 2, { updatedAt: "2026-11-05" }),
      story("low", 1, { updatedAt: "2026-11-09" }),
    ];
    expect(focusStory(stories, new Set())?.story.id).toBe("newest");
    const j = firstStoryJourney(stories, new Set());
    expect(states(j)).toEqual(["done", "done", "done", "now", "locked"]);
    expect(j.next).toEqual({ href: "/stories/newest", label: "Take it to Level 3" });
  });

  it("sends a started story back to the builder, and a Level 3 one to practice", () => {
    expect(firstStoryJourney([story("s", 0)], new Set()).next).toEqual({
      href: "/stories/s",
      label: "Finish telling it",
    });
    expect(firstStoryJourney([story("s", 3)], new Set(), "/jobs/j/practice").next).toEqual({
      href: "/jobs/j/practice",
      label: "Practice it out loud",
    });
  });

  it("is done once a story is said out loud", () => {
    const j = firstStoryJourney([story("s", 3)], new Set(["s"]));
    expect(j.done).toBe(true);
    expect(j.next).toBeUndefined();
    expect(states(j).every((s) => s === "done")).toBe(true);
  });
});

describe("the core six", () => {
  it("fills six slots with written stories, best first", () => {
    const j = coreSixJourney([story("a", 1), story("b", 3), story("c", 0)], new Set(["b"]));
    expect(j.steps.map((s) => s.state)).toEqual(["done", "done", "now", "locked", "locked", "locked"]);
    expect(j.steps[0]).toMatchObject({ label: "Story b", tag: "Level 4", xp: 500 });
    expect(j.steps[1]).toMatchObject({ label: "Story a", tag: "Level 1", xp: 50 });
    expect(j.next).toEqual({ href: "/stories/new", label: "Start your next story" });
    expect(j.blurb).toMatch(/^2 of 6 written/);
  });

  it("once six are written, sends the lowest one up a level", () => {
    const stories = ["a", "b", "c", "d", "e"].map((id) => story(id, 3)).concat(story("f", 2));
    const j = coreSixJourney(stories, new Set(["a", "b", "c", "d", "e"]));
    expect(j.done).toBe(false);
    expect(j.next).toEqual({ href: "/stories/f", label: "Take “Story f” to Level 3" });
    const all = coreSixJourney(
      ["a", "b", "c", "d", "e", "f"].map((id) => story(id, 3)),
      new Set(["a", "b", "c", "d", "e", "f"]),
    );
    expect(all.done).toBe(true);
    expect(all.next).toBeUndefined();
  });
});

describe("fix your weakest skill", () => {
  it("is locked until a story is graded", () => {
    const j = weakestSkillJourney(skillsMap([]));
    expect(j.next).toBeUndefined();
    expect(j.steps.every((s) => s.state === "locked")).toBe(true);
  });

  it("picks the weakest skill and points at a new story", () => {
    const map = skillsMap([story("a", 2, { scores: [3, 3, 2, 3, 3] })]);
    const j = weakestSkillJourney(map);
    expect(j.title).toBe("Fix your weakest skill: concrete actions");
    expect(j.steps.map((s) => s.state)).toEqual(["done", "now", "locked"]);
    expect(j.next?.href).toBe("/stories/new");
  });
});

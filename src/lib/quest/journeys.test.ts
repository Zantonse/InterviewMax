import { describe, expect, it } from "vitest";
import { firstStoryJourney, focusStory } from "./journeys";
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

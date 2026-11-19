import { describe, expect, it } from "vitest";
import { emptyContent, type StoryContent } from "./content";
import { helpAmount, isWrittenBehavioral, writtenBefore } from "./help-fade";

const draft = (writtenAt = "2026-11-12T10:00:00Z"): StoryContent => ({
  ...emptyContent(),
  draft: { parts: { answer: "x" }, untracedNumbers: [], model: "m", writtenAt },
});

describe("help fade", () => {
  it("gives full help on the first story, less on the second, light after", () => {
    expect(helpAmount(0)).toBe("full");
    expect(helpAmount(1)).toBe("some");
    expect(helpAmount(2)).toBe("light");
    expect(helpAmount(9)).toBe("light");
  });

  it("counts only written behavioral stories, leaving the open one out", () => {
    const stories = [
      { id: "a", storyType: "major_project", content: draft() },
      { id: "b", storyType: "went_wrong", content: draft() },
      { id: "c", storyType: "went_wrong", content: emptyContent() },
      { id: "d", storyType: "about_me", content: draft() },
      { id: "e", storyType: "tough_why_leaving", content: draft() },
    ];
    expect(writtenBefore(stories, null)).toBe(2);
    expect(writtenBefore(stories, "a")).toBe(1);
    expect(isWrittenBehavioral(stories[3])).toBe(false);
    expect(isWrittenBehavioral(stories[4])).toBe(false);
  });
});

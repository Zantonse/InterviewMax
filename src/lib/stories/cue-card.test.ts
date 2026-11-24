import { describe, expect, it } from "vitest";
import { keyFigure, storyThemes } from "./cue-card";
import { clock, storySeconds } from "./spoken";
import { getStoryType } from "./story-types";

describe("keyFigure", () => {
  it("turns a from-to change into a before and after", () => {
    expect(
      keyFigure({
        situation: "Last spring our booking flow lost about 38% of patients at the insurance step.",
        result: "Drop-off at the insurance step fell from 38% to 21% at the four pilot clinics.",
      }),
    ).toBe("38% → 21%");
    expect(keyFigure({ result: "No-shows went from about 14% down to 9% in a quarter." })).toBe(
      "14% → 9%",
    );
  });

  it("keeps a count's noun and drops trailing small words", () => {
    expect(keyFigure({ present: "PM at Carelane. I own patient booking for 31 clinics." })).toBe(
      "31 clinics",
    );
    expect(keyFigure({ result: "We signed off in 2 weeks at the steering group." })).toBe("2 weeks");
  });

  it("looks in the result first", () => {
    expect(
      keyFigure({ situation: "A team of 6 engineers.", result: "Revenue grew $2.4M in a year." }),
    ).toBe("$2.4M");
  });

  it("skips years and stories with no figure", () => {
    expect(keyFigure({ result: "In 2023 the compliance lead signed off." })).toBeUndefined();
    expect(keyFigure({ result: "She agreed to the pilot." })).toBeUndefined();
    expect(keyFigure(undefined)).toBeUndefined();
  });
});

describe("storyThemes", () => {
  it("names the themes a story type answers, short", () => {
    expect(storyThemes("cross_team")).toEqual(["Influence", "Cross-team work"]);
    expect(storyThemes("about_me")).toEqual(["The opener"]);
    expect(storyThemes(null)).toEqual([]);
  });
});

describe("spoken time", () => {
  it("counts the story's parts at 150 words a minute, to 5 seconds", () => {
    const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");
    const type = getStoryType("went_wrong");
    expect(storySeconds({ situation: words(100), result: words(125) }, type)).toBe(90);
    expect(clock(90)).toBe("1:30");
    expect(clock(5)).toBe("0:05");
  });
});

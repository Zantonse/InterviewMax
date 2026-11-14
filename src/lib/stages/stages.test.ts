import { describe, expect, it } from "vitest";
import { orderForStage, questionsForStage, stageFor, STAGES } from "./stages";

const q = (theme: string) => ({ theme, question: theme });

describe("stageFor", () => {
  it("prefers the stage the user set", () => {
    expect(stageFor("hiring_manager", "recruiter")).toEqual({
      id: "hiring_manager",
      guessed: false,
    });
  });
  it("falls back to the timeline's guess, marked as a guess", () => {
    expect(stageFor(null, "hiring_manager")).toEqual({
      id: "hiring_manager",
      guessed: true,
    });
  });
  it("ignores an unknown stage and gives null with nothing to go on", () => {
    expect(stageFor("lunch", null)).toBeNull();
  });
});

describe("orderForStage", () => {
  const items = [q("conflict"), q("impact"), q("about_you"), q("success")];

  it("puts a recruiter screen's themes first, in its order", () => {
    expect(orderForStage(items, "recruiter").map((x) => x.theme)).toEqual([
      "about_you",
      "success",
      "impact",
      "conflict",
    ]);
  });
  it("changes nothing with no stage or another round", () => {
    expect(orderForStage(items, null)).toBe(items);
    expect(orderForStage(items, "other")).toBe(items);
  });
});

describe("questionsForStage", () => {
  it("keeps only the stage's themes when there are enough", () => {
    const items = [q("conflict"), q("impact"), q("about_you"), q("success")];
    expect(questionsForStage(items, "recruiter").map((x) => x.theme)).toEqual([
      "about_you",
      "success",
      "impact",
    ]);
  });
  it("keeps everything, stage first, when there are too few", () => {
    const items = [q("conflict"), q("about_you")];
    expect(questionsForStage(items, "recruiter").map((x) => x.theme)).toEqual([
      "about_you",
      "conflict",
    ]);
  });
});

it("lists every stage in the usual order", () => {
  expect(STAGES.map((s) => s.id)).toEqual([
    "recruiter",
    "hiring_manager",
    "panel",
    "final",
    "other",
  ]);
});

import { describe, expect, it } from "vitest";
import { orderForStage, questionsForStage, stageFor, stageTips, STAGES, STAGE_GUIDES } from "./stages";

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
    "technical",
    "case",
    "panel",
    "final",
    "other",
  ]);
});

describe("stage tags from predict", () => {
  const t = (theme: string, stages: string[]) => ({ theme, question: `${theme}?`, stages });
  const items = [
    t("impact", ["hiring_manager", "recruiter"]),
    t("conflict", ["hiring_manager"]),
    t("about_you", ["recruiter", "hiring_manager"]),
    t("success", ["recruiter"]),
  ];

  it("puts questions whose main stage is this one first, then those that list it second", () => {
    expect(orderForStage(items, "recruiter").map((x) => x.theme)).toEqual([
      "about_you",
      "success",
      "impact",
      "conflict",
    ]);
  });

  it("uses the tags, not the themes, when the list has them", () => {
    expect(questionsForStage(items, "hiring_manager").map((x) => x.theme)).toEqual([
      "impact",
      "conflict",
      "about_you",
    ]);
  });

  it("places an untagged default question in a tagged list by its theme", () => {
    const withAi = [...items, { theme: "ai_use", question: "AI?" }];
    expect(questionsForStage(withAi, "recruiter").map((x) => x.theme)).toContain("ai_use");
  });
});

describe("technical and case rounds", () => {
  it("sit between the hiring manager and the panel, pointing to case questions", () => {
    const ids = STAGES.map((s) => s.id);
    expect(ids.indexOf("technical")).toBe(ids.indexOf("hiring_manager") + 1);
    expect(ids.indexOf("case")).toBe(ids.indexOf("panel") - 1);
    expect(STAGE_GUIDES.technical.cases).toBe(true);
    expect(STAGE_GUIDES.case.cases).toBe(true);
    expect(STAGE_GUIDES.recruiter.cases).toBeUndefined();
  });

  it("add data governance tips after the general ones, for that field only", () => {
    const general = stageTips("technical");
    const dg = stageTips("technical", "data_governance");
    expect(dg.slice(0, general.length)).toEqual(general);
    expect(dg.join(" ")).toMatch(/Collibra/);
    expect(stageTips("technical", "product_design")).toEqual(general);
    expect(stageTips("case", "data_governance").join(" ")).toMatch(/inventory of the company's AI models/);
  });
});

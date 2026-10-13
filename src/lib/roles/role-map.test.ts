import { describe, expect, it } from "vitest";
import { allAnswerText, emptyContent, parseContent } from "@/lib/stories/content";
import { answersTranscript } from "@/lib/stories/prompts";
import { getStoryType } from "@/lib/stories/story-types";
import { ROLE_FAMILIES, getRoleFamily } from "./families";
import { parseFunctionMap, parseProfile, profileMessages } from "./prompts";
import {
  type RoleMap,
  hasEnoughAnswers,
  parseRoleMap,
  roleLabel,
  roleMapStage,
  roleVocabulary,
} from "./role-map";

const governance = getRoleFamily("data_governance")!;

function map(overrides: Partial<RoleMap> = {}): RoleMap {
  return {
    familyId: governance.id,
    functions: governance.functions,
    answers: {
      title: "Data quality analyst, enterprise data team",
      week: "Writing quality checks and fixing broken feeds",
      owned: "The quality rules for 40 finance tables",
      came_to_you: "Finance analysts when numbers looked wrong",
    },
    marks: {},
    ...overrides,
  };
}

describe("role families", () => {
  it("has hand-written maps with unique part ids, data governance first", () => {
    expect(ROLE_FAMILIES[0].id).toBe("data_governance");
    for (const family of ROLE_FAMILIES) {
      const ids = family.functions.map((f) => f.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(family.functions.every((f) => f.terms.length > 0)).toBe(true);
    }
  });
});

describe("roleMapStage", () => {
  it("walks from questions to marks to profile", () => {
    expect(roleMapStage(undefined)).toBe("questions");
    expect(hasEnoughAnswers({ title: "x", week: "y", owned: "z" })).toBe(false);
    const m = map();
    expect(roleMapStage(m)).toBe("mark");
    for (const f of m.functions) m.marks[f.id] = "not_mine";
    expect(roleMapStage(m)).toBe("profile");
    m.profile = { scope: "s", strengths: [], fit: "", storyIdeas: [], model: "m", writtenAt: "" };
    expect(roleMapStage(m)).toBe("done");
  });

  it("names the owned parts first in the vocabulary", () => {
    const m = map({
      marks: { data_quality: "owned", lineage: "contributed", master_data: "not_mine" },
    });
    const words = roleVocabulary(m);
    expect(words[0]).toBe("data quality rules");
    expect(words).toContain("data lineage");
    expect(words).not.toContain("MDM");
    expect(roleLabel(m)).toBe("Data governance");
    expect(roleLabel(map({ familyId: null, roleName: "Revenue operations" }))).toBe(
      "Revenue operations",
    );
  });
});

describe("role map in the About me story", () => {
  it("round-trips through stories.content and feeds the transcript and number check", () => {
    const content = emptyContent();
    content.roleMap = map({ marks: { data_quality: "owned" }, seeded: ["now"] });
    const saved = parseContent(JSON.parse(JSON.stringify(content)));
    expect(saved.roleMap).toEqual(content.roleMap);
    expect(allAnswerText(saved)).toContain("40 finance tables");
    const transcript = answersTranscript(saved, getStoryType("about_me"));
    expect(transcript).toContain("My role map");
    expect(transcript).toContain("Parts of the function I owned: Data quality.");
  });

  it("drops junk when parsing", () => {
    expect(parseRoleMap("x")).toBeUndefined();
    const parsed = parseRoleMap({
      functions: [{ id: "a" }, { id: "b", label: "B" }],
      marks: { b: "nope" },
    });
    expect(parsed?.functions.map((f) => f.id)).toEqual(["b"]);
    expect(parsed?.marks).toEqual({});
  });
});

describe("role prompts", () => {
  it("parses a model-built function map", () => {
    const parts = ["Pipeline ops", "Forecasting", "CRM admin", "Pipeline ops"].map(
      (label) => `{"label":"${label}","blurb":"b","terms":["t"]}`,
    );
    const result = parseFunctionMap(
      `{"function":"Revenue operations","parts":[${parts.join(",")}]}`,
    );
    expect(result.name).toBe("Revenue operations");
    expect(result.functions.map((f) => f.id)).toEqual(["pipeline_ops", "forecasting", "crm_admin"]);
    expect(() => parseFunctionMap('{"parts":[{"label":"One"}]}')).toThrow();
  });

  it("parses a profile and keeps only real, non-required story ideas", () => {
    const profile = parseProfile(
      '{"scope":" S ","strengths":["A","",3],"fit":"F","storyIdeas":[{"storyType":"went_wrong","why":"W"},{"storyType":"about_me","why":"x"},{"storyType":"made_up","why":"x"}]}',
    );
    expect(profile).toEqual({
      scope: "S",
      strengths: ["A"],
      fit: "F",
      storyIdeas: [{ storyType: "went_wrong", why: "W" }],
    });
  });

  it("gives the profile call their answers and marks", () => {
    const m = map({ marks: { data_quality: "owned", stewardship: "contributed" } });
    const [message] = profileMessages(m, "Data governance");
    expect(message.content).toContain("40 finance tables");
    expect(message.content).toContain("Owned it: Data quality");
    expect(message.content).toContain("Contributed: Data stewardship");
  });
});

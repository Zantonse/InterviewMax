import { describe, expect, it } from "vitest";
import { caseKind, withFieldStarters } from "@/lib/cases/content";
import { getNumbersFamily } from "@/lib/numbers/families";
import { getRoleFamily } from "@/lib/roles/families";
import { questionHelp } from "@/lib/stories/help";
import { STORY_TYPES } from "@/lib/stories/story-types";
import { STEP_MODELS } from "@/lib/ai/config";
import { withFieldLine } from "./prompt";
import { FIELDS, FIELD_IDS, FIELD_STEPS, fieldJoggers, fieldPromptLine, guessField } from "./fields";

describe("fields", () => {
  it("lists every id once, and points only at lists that exist", () => {
    expect(FIELDS.map((f) => f.id)).toEqual([...FIELD_IDS]);
    for (const f of FIELDS) {
      if (f.roleFamily) expect(getRoleFamily(f.roleFamily), f.id).toBeDefined();
      if (f.numbersFamily) expect(getNumbersFamily(f.numbersFamily), f.id).toBeDefined();
      for (const type of Object.keys(f.joggers ?? {})) {
        expect(STORY_TYPES.some((t) => t.id === type), `${f.id} ${type}`).toBe(true);
      }
      for (const key of Object.keys(f.examples ?? {})) {
        expect(questionHelp(key), `${f.id} ${key}`).toBeDefined();
      }
    }
    for (const step of FIELD_STEPS) expect(STEP_MODELS[step]).toBeDefined();
    expect(FIELD_STEPS).not.toContain("storyGrade");
  });

  it("swaps builder examples and joggers for the field, keeping where to look", () => {
    const base = questionHelp("result")!;
    const design = questionHelp("result", "product_design")!;
    expect(design.example).toMatch(/usability/);
    expect(design.whereToLook).toBe(base.whereToLook);
    expect(questionHelp("present", "sales_engineering")).toEqual(questionHelp("present"));
    expect(questionHelp("present", "generic")!.example).not.toMatch(/sales|account executive/i);
    expect(fieldJoggers("product_design", "major_project")).toContain(
      "A design you shipped that moved a metric",
    );
    expect(fieldJoggers("sales_engineering", "major_project")).toBeUndefined();
  });

  it("guesses from job titles", () => {
    expect(guessField(["Senior Product Designer"])).toBe("product_design");
    expect(guessField(["UX Designer, Growth"])).toBe("product_design");
    expect(guessField(["Solutions Engineer, Strategic"])).toBe("sales_engineering");
    expect(guessField(["Data Governance Analyst"])).toBe("data_governance");
    expect(guessField(["Chef"])).toBeUndefined();
  });

  it("adds one prompt line for a chosen field, and nothing for general", () => {
    expect(fieldPromptLine({ id: "generic", name: null, guessed: false })).toBe("");
    expect(fieldPromptLine({ id: "other", name: "", guessed: false })).toBe("");
    expect(fieldPromptLine({ id: "other", name: "Revenue operations", guessed: false })).toMatch(
      /Revenue operations/,
    );
    const field = { id: "product_design" as const, name: null, guessed: false };
    expect(withFieldLine("storyProbe", "SYSTEM", field)).toMatch(/^SYSTEM\n\nThe user's field: Product design/);
    expect(withFieldLine("storyGrade", "SYSTEM", field)).toBe("SYSTEM");
  });

  it("gives designers portfolio and critique frames and starters", () => {
    expect(caseKind("Walk me through a project in your portfolio")).toBe("portfolio");
    expect(caseKind("Critique the checkout flow of an app you use")).toBe("critique");
    expect(caseKind("How would you design a parking app?")).toBe("critique");
    expect(caseKind("Pick an app you use every day. What would you improve?")).toBe("critique");
    expect(caseKind("How do you use SQL?")).toBe("skill");
    expect(caseKind("Should we add a premium battery line?")).toBe("case");
    const list = withFieldStarters(
      [{ question: "Pick an app you use every day. What would you improve, and how?", kind: "critique", here: true }],
      "product_design",
    );
    expect(list).toHaveLength(3);
    expect(list.filter((q) => q.starter)).toHaveLength(2);
    expect(withFieldStarters([], "sales_engineering")).toEqual([]);
  });
});

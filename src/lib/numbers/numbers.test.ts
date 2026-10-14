import { describe, expect, it } from "vitest";
import { emptyContent } from "@/lib/stories/content";
import { untracedNumbers } from "@/lib/stories/numbers";
import { probeMessages, writeMessages } from "@/lib/stories/prompts";
import { getStoryType } from "@/lib/stories/story-types";
import {
  type NumbersChecklist,
  checklistItems,
  hasEnoughNumbers,
  numbersForStory,
  numbersTranscript,
  parseChecklist,
} from "./checklist";
import { NUMBERS_FAMILIES, getNumbersFamily, guessFamily } from "./families";
import { parseNumbersDraft } from "./prompts";

const se: NumbersChecklist = {
  familyId: "sales_engineering",
  values: { aes_supported: "6 AEs", win_rate: "about 38%" },
  updatedAt: "",
};

describe("hand-written families", () => {
  it("cover sales engineering, finance and data governance", () => {
    expect(NUMBERS_FAMILIES.map((f) => f.id)).toEqual(
      expect.arrayContaining(["sales_engineering", "finance", "data_governance"]),
    );
  });

  it("name numbers, never values, and fit real story types", () => {
    for (const family of NUMBERS_FAMILIES) {
      const ids = family.items.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const item of family.items) {
        expect(item.why + item.where).not.toMatch(/\d/);
        expect(item.storyTypes.length).toBeGreaterThan(0);
        for (const t of item.storyTypes) expect(getStoryType(t)).toBeDefined();
      }
    }
  });
});

describe("guessFamily", () => {
  it("reads the family from a title, in order", () => {
    expect(guessFamily([undefined, "Senior Solutions Engineer"])).toBe("sales_engineering");
    expect(guessFamily(["FP&A Manager"])).toBe("finance");
    expect(guessFamily(["I was a data steward for the finance domain"])).toBe("data_governance");
    expect(guessFamily(["Product designer"])).toBeUndefined();
  });
});

describe("parseChecklist", () => {
  it("reads a hand-written family's items from code", () => {
    const checklist = parseChecklist({ familyId: "finance", values: { budget_size: " $4M " } });
    expect(checklist?.values).toEqual({ budget_size: "$4M" });
    expect(checklistItems(checklist!)).toBe(getNumbersFamily("finance")!.items);
  });

  it("keeps a drafted list and drops junk", () => {
    const checklist = parseChecklist({
      familyId: null,
      roleName: "Revenue operations",
      items: [{ id: "a", label: "Reps supported", why: "", where: "CRM", storyTypes: ["x", 3] }, 5],
      values: { a: "40 reps", b: 7 },
    });
    expect(checklist?.items).toEqual([
      { id: "a", label: "Reps supported", why: "", where: "CRM", storyTypes: ["x"] },
    ]);
    expect(checklist?.values).toEqual({ a: "40 reps" });
  });

  it("returns null with nothing to show", () => {
    expect(parseChecklist(null)).toBeNull();
    expect(parseChecklist({ familyId: "unknown", values: {} })).toBeNull();
  });
});

describe("numbersForStory", () => {
  it("keeps the numbers that fit the story, filled ones first", () => {
    const numbers = numbersForStory(se, "defining_success");
    expect(numbers.every((n) => n.storyTypes.includes("defining_success"))).toBe(true);
    expect(numbers.slice(0, 2).map((n) => n.value)).toEqual(["6 AEs", "about 38%"]);
    expect(numbers.slice(2).every((n) => !n.value)).toBe(true);
  });

  it("is empty without a checklist", () => {
    expect(numbersForStory(null, "major_project")).toEqual([]);
  });
});

describe("hasEnoughNumbers", () => {
  it("needs a few numbers filled in", () => {
    expect(hasEnoughNumbers(null)).toBe(false);
    expect(hasEnoughNumbers(se)).toBe(false);
    expect(hasEnoughNumbers({ ...se, values: { ...se.values, avg_deal: "$85K" } })).toBe(true);
  });
});

describe("in the story builder", () => {
  const storyType = getStoryType("defining_success");
  const numbers = numbersForStory(se, "defining_success");

  it("asks for the missing numbers in the follow-ups, but never the filled ones", () => {
    const text = probeMessages(emptyContent(), storyType, undefined, undefined, numbers)[0].content;
    expect(text).toContain("Account executives you supported: 6 AEs");
    expect(text).toContain("Average deal size (ARR) (where to find it:");
    expect(text).toContain("Never ask for a number I already filled in");
  });

  it("gives the writer only the filled-in values", () => {
    const text = writeMessages(emptyContent(), storyType, undefined, numbers)[0].content;
    expect(text).toContain("Win rate or technical win rate on your deals: about 38%");
    expect(text).not.toContain("Average deal size");
  });

  it("leaves the prompts as they were without a checklist", () => {
    expect(numbersTranscript([], { ask: true })).toBe("");
    expect(writeMessages(emptyContent(), storyType)[0].content).not.toContain("checklist");
  });

  it("lets a filled-in value trace in a story", () => {
    const story = "I supported 6 AEs and kept a 38% win rate.";
    const answers = "I ran the technical side of every deal.";
    expect(untracedNumbers(story, answers)).toEqual(["6", "38%"]);
    const values = numbers.flatMap((n) => (n.value ? [n.value] : [])).join("\n");
    expect(untracedNumbers(story, `${answers}\n${values}`)).toEqual([]);
  });
});

describe("parseNumbersDraft", () => {
  const item = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    label: `Label ${id}`,
    why: "Shows scale.",
    where: "Your CRM.",
    storyTypes: ["major_project", "not_a_type"],
    ...extra,
  });

  it("reads the drafted list and drops lines that suggest a figure", () => {
    const { role, items } = parseNumbersDraft(
      JSON.stringify({
        role: "Revenue operations",
        numbers: [item("a"), item("b"), item("c"), item("d"), item("e", { where: "Usually 20%" })],
      }),
    );
    expect(role).toBe("Revenue operations");
    expect(items.map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
    expect(items[0].storyTypes).toEqual(["major_project"]);
  });

  it("refuses a list that's too short", () => {
    expect(() => parseNumbersDraft(JSON.stringify({ numbers: [item("a")] }))).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { parseCasePracticeReply } from "@/lib/cases/prompts";
import { parseFeedback } from "@/lib/practice/prompts";
import { withFieldLine } from "./prompt";
import { FIELD_STEPS } from "./fields";
import { FIELD_PITFALLS, PITFALL_STEPS, parsePitfalls, pitfallPromptLine } from "./pitfalls";

const dg = { id: "data_governance" as const, name: null, guessed: false };

describe("field mistakes", () => {
  it("lists data governance's six, with unique ids, on field steps only", () => {
    const ids = FIELD_PITFALLS.data_governance!.map((p) => p.id);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
    for (const step of PITFALL_STEPS) expect(FIELD_STEPS).toContain(step);
  });

  it("adds the list to feedback steps for data governance only", () => {
    expect(pitfallPromptLine("casePractice", dg)).toMatch(/textbook:/);
    expect(pitfallPromptLine("practiceFeedback", dg)).toMatch(/"pitfalls"/);
    expect(pitfallPromptLine("storyWrite", dg)).toBe("");
    expect(pitfallPromptLine("casePractice", { id: "product_design", name: null, guessed: false })).toBe("");
    expect(pitfallPromptLine("casePractice", null)).toBe("");
    const system = withFieldLine("casePractice", "SYSTEM", dg)!;
    expect(system.startsWith("SYSTEM\n\nThe user's field: Data governance")).toBe(true);
    expect(system).toMatch(/no_ai:/);
    expect(withFieldLine("storyProbe", "SYSTEM", dg)).not.toMatch(/no_ai:/);
  });

  it("keeps known ids once, at most two, and drops notes with new figures", () => {
    const hits = parsePitfalls(
      [
        { id: "textbook", note: "You defined lineage but never said how you set it up." },
        { id: "textbook", note: "Again." },
        { id: "made_up", note: "Unknown." },
        { id: "unquantified", note: "Say it cut issues by 40%." },
        { id: "no_ai", note: "Say how you'd keep a model inventory." },
        { id: "quality_only", note: "Third one is dropped." },
      ],
      "What is data lineage? Lineage is where data comes from.",
    );
    expect(hits.map((h) => h.id)).toEqual(["textbook", "no_ai"]);
    expect(hits[0].label).toBe("Textbook definition");
    expect(parsePitfalls("nope")).toEqual([]);
  });

  it("comes through case and practice feedback", () => {
    const caseFb = parseCasePracticeReply(
      JSON.stringify({
        summary: "Clear but generic.",
        covered: [],
        missing: [],
        followUp: "",
        pitfalls: [{ id: "management", note: "You described building pipelines, not who decides." }],
      }),
      { question: "How would you set up governance?", kind: "case", answer: "I'd build pipelines." },
    );
    expect(caseFb.pitfalls?.[0].id).toBe("management");
    const none = parseCasePracticeReply(
      JSON.stringify({ summary: "Fine.", covered: [], missing: [], followUp: "" }),
      { question: "q", kind: "case", answer: "a" },
    );
    expect(none.pitfalls).toBeUndefined();
    const practice = parseFeedback(
      JSON.stringify({ summary: "Landed.", pitfalls: [{ id: "unquantified", note: "Name the root cause." }] }),
      false,
    );
    expect(practice.pitfalls.map((p) => p.id)).toEqual(["unquantified"]);
  });
});

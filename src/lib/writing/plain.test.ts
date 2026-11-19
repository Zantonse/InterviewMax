import { describe, expect, it } from "vitest";
import { aiTells, PLAIN_WORDING_RULES, plainPunctuation, tellsProblem, withPlainWording } from "./plain";

// Kevin's example (Nov 13): the writer's output that sounded "AI punchy".
const KEVIN =
  "I sat down with my HR business leader to understand what they actually needed, then I came up with the solution: give Collibra access to the data warehouse through a direct connection. That gave my team a connection to the internal data warehouse that updated continuously on a synchronized schedule. The hard part wasn't the connection itself — it was approval to open it";

describe("plainPunctuation", () => {
  it("swaps em dashes for commas", () => {
    expect(plainPunctuation("the connection itself — it was approval")).toBe(
      "the connection itself, it was approval",
    );
    expect(plainPunctuation("the tool—Collibra—was ready")).toBe("the tool, Collibra, was ready");
  });

  it("drops a dash before other punctuation or a closing quote", () => {
    expect(plainPunctuation('{"a": "we shipped it —", "b": "done —."}')).toBe(
      '{"a": "we shipped it", "b": "done."}',
    );
  });

  it("swaps spaced en dashes and double hyphens but keeps ranges and hyphenated words", () => {
    expect(plainPunctuation("it was hard – really hard")).toBe("it was hard, really hard");
    expect(plainPunctuation("it was hard -- really hard")).toBe("it was hard, really hard");
    expect(plainPunctuation("10–20 people, a well-known tool")).toBe(
      "10–20 people, a well-known tool",
    );
  });

  it("handles escaped dashes in JSON", () => {
    expect(plainPunctuation('{"a": "first \\u2014 second"}')).toBe('{"a": "first, second"}');
  });

  it("keeps the JSON parseable", () => {
    const raw = JSON.stringify({ parts: { result: "We hit it — 40% fewer tickets —" } });
    expect(JSON.parse(plainPunctuation(raw))).toEqual({
      parts: { result: "We hit it, 40% fewer tickets" },
    });
  });
});

describe("aiTells", () => {
  it("finds the tells in Kevin's example", () => {
    const tells = aiTells(KEVIN, "I talked to HR. We needed approval to open the connection.");
    expect(tells).toContain("what they actually needed");
    expect(tells.some((t) => t.startsWith("wasn't the connection itself"))).toBe(true);
  });

  it("finds contrast set-ups, reveals and stock phrases", () => {
    const answers = "notes";
    expect(aiTells("It wasn't about the tool, it was about trust.", answers)).toHaveLength(1);
    expect(aiTells("It was not just a fix but a new process.", answers)).toHaveLength(1);
    expect(aiTells("The result? 40% fewer tickets.", answers)).toEqual(["The result?"]);
    expect(aiTells("Here's the thing: it was a game changer.", answers)).toEqual([
      "Here's the thing",
      "game changer",
    ]);
  });

  it("leaves out what the user said themselves", () => {
    const draft = "I asked what they actually needed and it turns out it was a report.";
    expect(aiTells(draft, "I asked what they actually needed, turns out it was a report")).toEqual(
      [],
    );
  });

  it("passes plain spoken wording", () => {
    const plain =
      "I sat down with our HR business leader to find out what they needed. I set up a direct connection from Collibra to the data warehouse, so my team had data that refreshed on a schedule. Getting approval to open that connection was the hard part, and it took three weeks. It wasn't easy, but we got there.";
    expect(aiTells(plain, "")).toEqual([]);
  });
});

describe("prompt rules", () => {
  it("adds the rules to writing steps only", () => {
    expect(withPlainWording("storyWrite", "SYSTEM")).toBe(`SYSTEM\n\n${PLAIN_WORDING_RULES}`);
    expect(withPlainWording("storyGrade", "SYSTEM")).toBe("SYSTEM");
  });

  it("turns tells into one retry problem", () => {
    expect(tellsProblem("All plain here.", "")).toEqual([]);
    expect(tellsProblem("The result? Done.", "")[0]).toContain('"The result?"');
  });
});

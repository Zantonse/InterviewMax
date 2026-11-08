import { describe, expect, it } from "vitest";
import { dropRepeats, overlap } from "./repeats";

const f = (question: string) => ({ question, gap: "result", round: 2 });

describe("dropRepeats", () => {
  it("drops a follow-up that asks again what was already asked", () => {
    const kept = dropRepeats(
      [
        f("What number shows the result of the demo?"),
        f("Who else was in the room, and what did they decide?"),
      ],
      ["What was the result of the demo, in numbers?"],
    );
    expect(kept.map((k) => k.question)).toEqual([
      "Who else was in the room, and what did they decide?",
    ]);
  });

  it("drops a repeat within the same round", () => {
    const kept = dropRepeats(
      [f("What did you personally decide?"), f("What did you decide personally, not the team?")],
      [],
    );
    expect(kept).toHaveLength(1);
  });

  it("keeps different questions about the same part", () => {
    expect(overlap("How did you measure the result?", "What would you do differently next time?")).toBeLessThan(0.7);
    expect(dropRepeats([f("What happened to the renewal afterwards?")], ["What was the hardest part?"])).toHaveLength(1);
  });
});

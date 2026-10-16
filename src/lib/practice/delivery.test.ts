import { describe, expect, it } from "vitest";
import { parseItems } from "./content";
import {
  countFillers,
  deliveryFor,
  fillerLevel,
  fillerNote,
  paceNote,
  paceVerdict,
  parseDelivery,
  pauseNote,
  roundDeliveryNote,
} from "./delivery";

const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");

describe("countFillers", () => {
  it("counts filler words and skips their ordinary uses", () => {
    const text =
      "Um, so we had, like, three weeks. I'd like to say it was easy, you know? It was kind of a mess. " +
      "What kind of team was it? Uh, basically a new one. I mean, we shipped it, right? " +
      "Do you know what I did? It looks like rain. So yeah.";
    const counts = Object.fromEntries(countFillers(text).map((f) => [f.word, f.count]));
    expect(counts).toEqual({
      um: 1,
      uh: 1,
      like: 1,
      "you know": 1,
      "kind of": 1,
      basically: 1,
      "I mean": 1,
      "right?": 1,
      "so yeah": 1,
    });
  });

  it("finds nothing in a clean answer", () => {
    expect(countFillers("I cut scope because the customer cared about the date.")).toEqual([]);
  });

  it("sorts the most used first", () => {
    expect(countFillers("Um, um, I, uh, um.")[0]).toEqual({ word: "um", count: 3 });
  });
});

describe("deliveryFor", () => {
  it("is null when nothing was said with Talk", () => {
    expect(deliveryFor([{ answer: "typed it" }])).toBeNull();
  });

  it("adds up the spoken answers and uses the measured talk time", () => {
    const d = deliveryFor([
      { answer: words(200), seconds: 100, talkSeconds: 80, longPauses: 1 },
      { answer: "typed follow-up answer" },
      { answer: `Um, ${words(49)}`, seconds: 25, talkSeconds: 20, longPauses: 0 },
    ])!;
    expect(d.words).toBe(250);
    expect(d.talkSeconds).toBe(100);
    expect(d.wpm).toBe(150);
    expect(d.fillerCount).toBe(1);
    expect(d.longPauses).toBe(1);
  });

  it("falls back to the recording length for older answers", () => {
    expect(deliveryFor([{ answer: words(120), seconds: 60 }])!.wpm).toBe(120);
  });

  it("gives no pace for a very short answer", () => {
    expect(deliveryFor([{ answer: "Yes, about forty percent.", seconds: 3 }])!.wpm).toBeNull();
  });
});

describe("notes", () => {
  const base = { words: 300, talkSeconds: 120, wpm: 150, fillers: [], fillerCount: 0, longPauses: 0 };

  it("judges pace", () => {
    expect(paceVerdict(100)).toBe("slow");
    expect(paceVerdict(150)).toBe("ok");
    expect(paceVerdict(190)).toBe("fast");
    expect(paceNote({ ...base, wpm: 190 })).toMatch(/fast/);
    expect(paceNote({ ...base, wpm: null })).toMatch(/Too short/);
  });

  it("judges fillers by the minute", () => {
    expect(fillerLevel({ ...base, fillerCount: 3 })).toBe("few");
    expect(fillerLevel({ ...base, fillerCount: 8 })).toBe("some");
    expect(fillerLevel({ ...base, fillerCount: 14 })).toBe("many");
    expect(fillerNote(base)).toMatch(/None/);
    expect(
      fillerNote({ ...base, fillers: [{ word: "like", count: 14 }], fillerCount: 14 }),
    ).toMatch(/“like” ×14.*distract/);
  });

  it("mentions long pauses only when there were some", () => {
    expect(pauseNote(base)).toBe("");
    expect(pauseNote({ ...base, longPauses: 2 })).toMatch(/2 times/);
  });

  it("sums up a round", () => {
    expect(roundDeliveryNote([])).toBe("");
    expect(
      roundDeliveryNote([
        { ...base, fillerCount: 2 },
        { ...base, fillerCount: 1 },
      ]),
    ).toBe("4 min of talking · 150 words a minute · 3 filler words (0.8 a minute)");
  });
});

describe("stored delivery", () => {
  it("reads back from practice_sessions.items with the turn's voice stats", () => {
    const [item] = parseItems([
      {
        question: "Q",
        theme: "conflict",
        reason: "gap",
        turns: [{ question: "Q", answer: "A", seconds: 90, talkSeconds: 70, longPauses: 2 }],
        feedback: {
          summary: "Good",
          timing: { seconds: 90, measured: true, words: 200, min: 60, max: 120 },
          delivery: {
            words: 200,
            talkSeconds: 70,
            wpm: 171,
            fillers: [{ word: "um", count: 2 }, { bad: true }],
            fillerCount: 2,
            longPauses: 2,
          },
        },
      },
    ]);
    expect(item.turns[0]).toMatchObject({ talkSeconds: 70, longPauses: 2 });
    expect(item.feedback?.delivery).toEqual({
      words: 200,
      talkSeconds: 70,
      wpm: 171,
      fillers: [{ word: "um", count: 2 }],
      fillerCount: 2,
      longPauses: 2,
    });
  });

  it("leaves older feedback without delivery", () => {
    expect(parseDelivery(undefined)).toBeUndefined();
    const [item] = parseItems([
      {
        question: "Q",
        theme: "conflict",
        turns: [],
        feedback: { summary: "x", timing: { seconds: 1 } },
      },
    ]);
    expect(item.feedback?.delivery).toBeUndefined();
  });
});

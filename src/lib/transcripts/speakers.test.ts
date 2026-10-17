import { describe, expect, it } from "vitest";
import {
  hasSpeakerLabels,
  labelledTranscript,
  parseSpeakerTurns,
  relabel,
  turnsFromLabelled,
} from "./speakers";

const UNLABELLED =
  "Thanks for joining today. Can you walk me through a time you drove adoption without authority? Sure. At my last company I owned data governance, and the stewards didn't report to me. How did you get them on board? I sat with each one and showed them what broke when their data was wrong. Great, thanks.";

describe("speaker labels", () => {
  it("tells labelled transcripts from unlabelled ones", () => {
    expect(hasSpeakerLabels(UNLABELLED)).toBe(false);
    expect(
      hasSpeakerLabels(
        "Jane Smith: Welcome.\nKevin Law: Thanks.\nJane Smith: Tell me about yourself.\nKevin Law: Sure, I lead data governance.",
      ),
    ).toBe(true);
    expect(
      hasSpeakerLabels(
        "[00:01] Speaker 1: Hi.\n[00:03] Speaker 2: Hello.\n[00:05] Speaker 1: Shall we start?\n[00:07] Speaker 2: Yes.",
      ),
    ).toBe(true);
    // One name only is a heading or a quote, not turns.
    expect(hasSpeakerLabels("Note: this was recorded.\nAgenda: intro, questions.")).toBe(false);
  });

  it("cuts the text at each turn's first words without changing a word of it", () => {
    const reply = JSON.stringify({
      turns: [
        { speaker: "interviewer", start: "Thanks for joining today. Can you walk" },
        { speaker: "me", start: "Sure. At my last   company I owned" },
        { speaker: "interviewer", start: "How did you get them on board?" },
        { speaker: "me", start: "I sat with each one and showed" },
        { speaker: "interviewer", start: "Great, thanks." },
        { speaker: "me", start: "words that are not in the transcript" },
      ],
    });
    const turns = parseSpeakerTurns(reply, UNLABELLED);
    expect(turns.map((t) => t.speaker)).toEqual(["interviewer", "me", "interviewer", "me", "interviewer"]);
    expect(turns.map((t) => t.text).join(" ")).toBe(UNLABELLED);
    expect(turns[1].text).toMatch(/^Sure\. At my last company/);
  });

  it("keeps text before the first turn it found, and merges neighbours on the same side", () => {
    const reply = JSON.stringify({
      turns: [
        { speaker: "interviewer", start: "Can you walk me through" },
        { speaker: "interviewer", start: "How did you get them" },
      ],
    });
    const turns = parseSpeakerTurns(reply, UNLABELLED);
    expect(turns).toHaveLength(1);
    expect(turns[0].text.startsWith("Thanks for joining")).toBe(true);
    expect(() => parseSpeakerTurns("not json", UNLABELLED)).toThrow();
  });

  it("round-trips through the labelled text, and relabels by turn", () => {
    const turns = [
      { speaker: "interviewer" as const, text: "Tell me about yourself." },
      { speaker: "me" as const, text: "I lead data governance.\n\nBefore that I was an analyst." },
      { speaker: "me" as const, text: "What's the team like?" },
    ];
    const text = labelledTranscript(turns);
    expect(text).toMatch(/^Interviewer: Tell me/);
    const back = turnsFromLabelled(text);
    expect(back.map((t) => t.speaker)).toEqual(["interviewer", "me", "me"]);
    expect(back[1].text).toContain("Before that I was an analyst.");

    const fixed = relabel(back, ["interviewer", "me", "interviewer"]);
    expect(fixed.map((t) => t.speaker)).toEqual(["interviewer", "me", "interviewer"]);
    const merged = relabel(back, ["me", "me", "interviewer"]);
    expect(merged).toHaveLength(2);
    expect(() => relabel(back, ["me"])).toThrow();
    expect(turnsFromLabelled("Jane: hi\n\nKevin: hello")).toEqual([]);
  });
});

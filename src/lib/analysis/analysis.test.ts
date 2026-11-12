import { describe, expect, it } from "vitest";
import { parseContent } from "@/lib/stories/content";
import { getStoryType, storyParts } from "@/lib/stories/story-types";
import { formatGuide, partLength, totalLength } from "./structure";
import { analysisIsCurrent, findQuote, parseAnalysis, writtenParts } from "./content";
import { ANALYZE_SYSTEM, analyzeMessages, parseAnalyzeReply } from "./prompts";

const conflict = getStoryType("difficult_stakeholder");

const PARTS = {
  situation: "Two weeks from launch, the vendor’s API kept timing out and the renewal was at risk.",
  actions: "I cut scope to the two flows the customer used daily and ran a daily check-in.",
  result: "We launched on time and renewed the $2.4M contract.",
};

const paragraphs = writtenParts(PARTS, conflict);

describe("findQuote", () => {
  it("returns the words as written in the paragraph, ignoring case and curly quotes", () => {
    expect(findQuote(PARTS.situation, "the vendor's API kept timing out")).toBe(
      "the vendor’s API kept timing out",
    );
    expect(findQuote(PARTS.result, "“Renewed the $2.4M contract”")).toBe(
      "renewed the $2.4M contract",
    );
  });

  it("drops words that aren't in the paragraph", () => {
    expect(findQuote(PARTS.result, "saved the team 40 hours")).toBeUndefined();
    expect(findQuote(PARTS.result, "we")).toBeUndefined();
    expect(findQuote(PARTS.result, undefined)).toBeUndefined();
  });
});

describe("parseAnalyzeReply", () => {
  it("keeps notes in story order, checks quotes and drops sharpen on strong parts", () => {
    const reply = parseAnalyzeReply(
      JSON.stringify({
        summary: "Someone who protects the date by cutting scope.",
        parts: [
          {
            part: "result",
            value: "Proves it paid off.",
            signals: ["Measurable impact", "Business sense", "Ownership", "Extra"],
            quote: "renewed the $2.4M contract",
            strength: "strong",
            sharpen: "Should be dropped",
          },
          {
            part: "situation",
            value: "Sets the stakes.",
            signals: ["Context"],
            quote: "made-up words not in the story",
            strength: "some",
            sharpen: "Say who was waiting on the launch.",
          },
          { part: "nope", value: "Not a part", signals: [], strength: "thin" },
        ],
      }),
      paragraphs,
    );
    expect(reply.summary).toBe("Someone who protects the date by cutting scope.");
    expect(reply.parts.map((p) => p.part)).toEqual(["situation", "result"]);
    expect(reply.parts[0].quote).toBeUndefined();
    expect(reply.parts[0].sharpen).toBe("Say who was waiting on the launch.");
    expect(reply.parts[1].quote).toBe("renewed the $2.4M contract");
    expect(reply.parts[1].signals).toHaveLength(3);
    expect(reply.parts[1].sharpen).toBeUndefined();
  });

  it("throws on an empty reply", () => {
    expect(() => parseAnalyzeReply("no json here", paragraphs)).toThrow();
    expect(() => parseAnalyzeReply(JSON.stringify({ parts: [] }), paragraphs)).toThrow();
  });

  it("treats an unknown strength as partly landing", () => {
    const reply = parseAnalyzeReply(
      JSON.stringify({
        parts: [{ part: "actions", value: "Shows a call.", strength: "great" }],
      }),
      paragraphs,
    );
    expect(reply.parts[0].strength).toBe("some");
  });
});

describe("analyzeMessages", () => {
  it("sends every paragraph with its part id, and the question it answers", () => {
    const [message] = analyzeMessages({
      title: "Saving the launch",
      storyType: conflict?.label,
      paragraphs,
      asked: "Tell me about a time you missed a deadline.",
      targets: "",
    });
    const text = String(message.content);
    for (const p of paragraphs) {
      expect(text).toContain(`Part id "${p.id}"`);
      expect(text).toContain(p.text);
    }
    expect(text).toContain("Tell me about a time you missed a deadline.");
    expect(text).toContain("No target jobs yet");
    expect(ANALYZE_SYSTEM).toContain("never suggest a fact");
  });
});

describe("stored analysis", () => {
  const analysis = {
    summary: "s",
    parts: [
      {
        part: "result",
        value: "v",
        signals: ["Impact"],
        quote: "$2.4M",
        strength: "strong",
      },
    ],
    model: "m",
    draftWrittenAt: "2026-11-05T00:00:00Z",
    analyzedAt: "2026-11-05T00:01:00Z",
  };

  it("survives a round trip through the story content", () => {
    const content = parseContent({
      version: 1,
      answers: {},
      draft: {
        parts: PARTS,
        untracedNumbers: [],
        model: "m",
        writtenAt: "2026-11-05T00:00:00Z",
      },
      analysis,
    });
    expect(content.analysis?.parts[0].quote).toBe("$2.4M");
    expect(analysisIsCurrent(content.analysis, content.draft?.writtenAt)).toBe(true);
    expect(analysisIsCurrent(content.analysis, "2026-11-06T00:00:00Z")).toBe(false);
  });

  it("is dropped when there is no draft or no notes", () => {
    expect(parseContent({ version: 1, answers: {}, analysis }).analysis).toBeUndefined();
    expect(parseAnalysis({ ...analysis, parts: [] }, PARTS)).toBeUndefined();
  });
});

describe("structure guide", () => {
  it("explains every part of both formats", () => {
    for (const type of [conflict, getStoryType("about_me")]) {
      const guide = formatGuide(type);
      for (const part of storyParts(type)) {
        expect(guide.parts[part.id]?.why).toBeTruthy();
        expect(guide.parts[part.id]?.lengthWhy).toBeTruthy();
      }
    }
  });

  it("says when a part is longer or shorter than usual", () => {
    const guide = formatGuide(conflict).parts.situation;
    const words = (n: number) => Array.from({ length: n }, () => "w").join(" ");
    expect(partLength(words(15), 100, guide).verdict).toBe("fits");
    expect(partLength(words(40), 100, guide).verdict).toBe("long");
    expect(partLength(words(40), 100, guide).note).toContain("40%");
    expect(partLength(words(5), 100, guide).verdict).toBe("short");
  });

  it("checks the whole story's length", () => {
    const guide = formatGuide(conflict);
    expect(totalLength(300, guide).verdict).toBe("fits");
    expect(totalLength(100, guide).verdict).toBe("short");
    expect(totalLength(500, guide).verdict).toBe("long");
  });
});

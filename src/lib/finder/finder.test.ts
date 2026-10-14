import { describe, expect, it } from "vitest";
import type { ThemeCoverage } from "@/lib/stories/bank";
import { parseContent } from "@/lib/stories/content";
import {
  FINDER_THEMES,
  MAX_MOMENTS,
  checkMoments,
  finderBasis,
  groupMoments,
  parseFinder,
  quickAnswerText,
  quoteIsIn,
  type FinderSource,
} from "./content";
import { FINDER_SYSTEM, finderMessages, parseFinderReply } from "./prompts";

const RESUME = `Jane Doe
Senior Product Manager, Acme Corp (2021 - present)
• Led the billing   migration from a homegrown system to Stripe across 3 product lines
• Partnered with Sales and Support to launch self-serve onboarding
Product Manager, Globex (2018 - 2021)
• Owned the mobile app roadmap for 40,000 field technicians`;

const sources: FinderSource[] = [{ id: "resume", text: RESUME }];

function raw(overrides: Record<string, unknown> = {}) {
  return {
    theme: "ambiguity",
    storyType: "prioritization",
    moment: "The billing migration at Acme",
    question: "a time you led through ambiguity?",
    quote: "Led the billing migration from a homegrown system to Stripe",
    source: "resume",
    ...overrides,
  };
}

describe("quoteIsIn", () => {
  it("matches across odd spacing, bullets and case", () => {
    expect(quoteIsIn("led the billing migration from a homegrown system", RESUME)).toBe(true);
    expect(
      quoteIsIn("“Led the billing migration from a homegrown system to Stripe.”", RESUME),
    ).toBe(true);
  });

  it("rejects paraphrases and scraps too short to point at a line", () => {
    expect(quoteIsIn("Led the payments migration to Stripe", RESUME)).toBe(false);
    expect(quoteIsIn("Stripe", RESUME)).toBe(false);
  });
});

describe("checkMoments", () => {
  it("keeps a moment whose quote is in the resume", () => {
    const [m] = checkMoments([raw()], sources);
    expect(m).toMatchObject({
      id: "m1",
      themeId: "ambiguity",
      storyType: "prioritization",
      moment: "The billing migration at Acme",
      source: "resume",
    });
  });

  it("drops a moment that quotes something not in any source", () => {
    expect(
      checkMoments([raw({ quote: "Led a team of 12 engineers through a reorg" })], sources),
    ).toEqual([]);
  });

  it("drops a moment with a number the source doesn't have", () => {
    expect(checkMoments([raw({ question: "a time you saved $2M?" })], sources)).toEqual([]);
    // A number from the resume is fine.
    expect(
      checkMoments(
        [
          raw({
            theme: "impact",
            storyType: "major_project",
            moment: "The roadmap for 40,000 technicians",
            quote: "Owned the mobile app roadmap for 40,000 field technicians",
          }),
        ],
        sources,
      ),
    ).toHaveLength(1);
  });

  it("drops unknown themes and About you, and fixes a story type that doesn't fit the theme", () => {
    expect(checkMoments([raw({ theme: "about_you" }), raw({ theme: "nope" })], sources)).toEqual(
      [],
    );
    const [m] = checkMoments([raw({ theme: "conflict", storyType: "major_project" })], sources);
    expect(m.storyType).toBe("difficult_stakeholder");
  });

  it("finds the quote in another source when the model names the wrong one", () => {
    const [m] = checkMoments(
      [raw({ source: "linkedin" })],
      [{ id: "linkedin", text: "Product leader" }, ...sources],
    );
    expect(m.source).toBe("resume");
  });

  it("drops duplicates and caps the list", () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      raw({ moment: `Moment ${"abcdefghijklmno"[i]}` }),
    );
    expect(checkMoments([raw(), raw()], sources)).toHaveLength(1);
    expect(checkMoments(many, sources)).toHaveLength(MAX_MOMENTS);
  });
});

describe("parseFinderReply", () => {
  it("reads JSON wrapped in text and checks it", () => {
    const text = `Here you go: ${JSON.stringify({ moments: [raw(), raw({ quote: "made up line here" })] })}`;
    expect(parseFinderReply(text, sources)).toHaveLength(1);
  });

  it("throws on a reply that isn't JSON", () => {
    expect(() => parseFinderReply("sorry", sources)).toThrow();
  });
});

describe("groupMoments", () => {
  it("puts themes with no story first", () => {
    const moments = checkMoments(
      [
        raw({ theme: "impact", storyType: "major_project", moment: "A" }),
        raw({ theme: "collaboration", storyType: "cross_team", moment: "B" }),
      ],
      sources,
    );
    const coverage = [
      { id: "impact", label: "Impact and results", status: "written" },
      { id: "collaboration", label: "Cross-team collaboration", status: "empty" },
    ] as ThemeCoverage[];
    expect(groupMoments(moments, coverage).map((g) => g.themeId)).toEqual([
      "collaboration",
      "impact",
    ]);
  });
});

describe("finder storage", () => {
  it("round-trips through parseFinder and ignores junk", () => {
    const moments = checkMoments([raw()], sources);
    const finder = parseFinder({
      moments: [...moments, { themeId: "nope" }],
      basis: "x",
      answers: { recent: "PM" },
    });
    expect(finder?.moments).toEqual(moments);
    expect(finder?.answers).toEqual({ recent: "PM" });
    expect(parseFinder("junk")).toBeNull();
  });

  it("changes the basis when a source changes", () => {
    expect(finderBasis(sources)).not.toBe(finderBasis([{ id: "resume", text: `${RESUME}!` }]));
  });

  it("joins quick answers in question order", () => {
    expect(quickAnswerText({ hard: "A reorg", recent: "PM at Acme" })).toBe("PM at Acme\nA reorg");
  });

  it("keeps a story's seed", () => {
    const seed = { moment: "M", question: "q?", quote: "line", sourceLabel: "your resume" };
    expect(parseContent({ answers: {}, seed }).seed).toEqual(seed);
    expect(parseContent({ answers: {}, seed: { moment: "" } }).seed).toBeUndefined();
  });
});

describe("finder prompt", () => {
  it("names every theme but About you, and lists empty themes", () => {
    expect(FINDER_THEMES.map((t) => t.id as string)).not.toContain("about_you");
    expect(FINDER_SYSTEM).toContain("ambiguity");
    const [msg] = finderMessages({ sources, emptyThemes: ["failure"], builtTypes: ["about_me"] });
    expect(msg.content).toContain("## My resume");
    expect(msg.content).toContain("failure (Failure and learning)");
    expect(msg.content).toContain("Tell me about yourself");
  });
});

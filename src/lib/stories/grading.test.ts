import { describe, expect, it } from "vitest";
import { gradeIsCurrent, parseContent, type StoryDraft } from "./content";
import {
  STAR_CRITERIA,
  INTRO_CRITERIA,
  combineGrade,
  fillerPhrases,
  gradeSystem,
  hedgedFigures,
  introFigures,
  lengthRange,
  parseGrade,
  pronounCounts,
  quickChecks,
  tierFor,
  type CheckResult,
  type CriterionScore,
} from "./grading";
import { getStoryType } from "./story-types";

const stakeholder = getStoryType("difficult_stakeholder");
const aboutMe = getStoryType("about_me");

const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");

function draft(parts: Record<string, string>, untracedNumbers: string[] = []): StoryDraft {
  return { parts, untracedNumbers, model: "test", writtenAt: "2026-10-13T00:00:00Z" };
}

const goodStar = draft({
  situation: `I was the lead engineer when the renewal was at risk. ${words(60)}`,
  role: `I owned the technical plan. ${words(30)}`,
  actions: `I met the CTO and I rebuilt the demo. We shipped it together. ${words(80)}`,
  result: "We renewed the $2.4M contract, 20% above plan.",
  reflection: `I learned to bring the skeptic in early. ${words(20)}`,
});

function scores(ids: readonly { id: string }[], score: number): CriterionScore[] {
  return ids.map((c) => ({ id: c.id, score, note: "" }));
}

function checks(overrides: Partial<Record<CheckResult["id"], boolean>> = {}): CheckResult[] {
  return (["number", "traced", "i_we", "length", "filler", "hedged"] as const).map((id) => ({
    id,
    pass: overrides[id] ?? true,
    detail: "",
  }));
}

describe("quick checks", () => {
  it("passes a story with a traced number in the result, mostly I, at a spoken length", () => {
    const result = quickChecks(goodStar, stakeholder);
    expect(result.map((c) => [c.id, c.pass])).toEqual([
      ["number", true],
      ["traced", true],
      ["i_we", true],
      ["length", true],
      ["filler", true],
      ["hedged", true],
    ]);
    expect(result[0].detail).toContain("$2.4M");
  });

  it("flags a result with no number and figures that aren't in the answers", () => {
    const d = draft({ ...goodStar.parts, result: "The customer renewed." }, ["40%"]);
    const result = quickChecks(d, stakeholder);
    expect(result.find((c) => c.id === "number")?.pass).toBe(false);
    expect(result.find((c) => c.id === "traced")?.detail).toContain("40%");
  });

  it("looks for the number in the proof point of Tell me about yourself", () => {
    const d = draft({
      present: "I lead solutions engineering.",
      highlight: "I closed 140% of quota.",
    });
    expect(quickChecks(d, aboutMe).find((c) => c.id === "number")?.pass).toBe(true);
    const short = quickChecks(d, aboutMe).find((c) => c.id === "length");
    expect(short?.pass).toBe(false);
    expect(short?.detail).toContain("aim for 150 to 225 words");
  });

  it("flags an introduction that lists too many figures, but not a STAR story", () => {
    const busy = draft({
      present: "I lead AI enablement for 400 SEs.",
      highlight: "I hit 140% of quota, closed $2.4M, cut ramp by 30% and trained 12 managers.",
    });
    const focus = quickChecks(busy, aboutMe).find((c) => c.id === "focus");
    expect(focus?.pass).toBe(false);
    expect(focus?.detail).toContain("save the rest for follow-up questions");
    const lean = draft({
      present: "I lead AI enablement for the entire SE org, since 2019.",
      highlight: "I hit 140% of quota.",
    });
    expect(quickChecks(lean, aboutMe).find((c) => c.id === "focus")?.pass).toBe(true);
    expect(quickChecks(goodStar, stakeholder).find((c) => c.id === "focus")).toBeUndefined();
  });

  it("doesn't count years as figures", () => {
    expect(introFigures("Since 2019 I've led 40 reps.")).toEqual(["40"]);
  });

  it("counts I against we, including contractions", () => {
    expect(pronounCounts("I'm sure we did it. My team and I. We've shipped. Me too.")).toEqual({
      i: 4,
      we: 2,
    });
    const weStory = draft({
      ...goodStar.parts,
      actions: "We did it. We did more. We won. We, we, we.",
    });
    expect(quickChecks(weStory, stakeholder).find((c) => c.id === "i_we")?.pass).toBe(false);
  });

  it("finds filler and vague phrases as whole words", () => {
    expect(fillerPhrases("I basically helped with a lot of   stuff. Variously stuffed.")).toEqual([
      "basically",
      "helped with",
      "a lot of",
      "stuff",
    ]);
  });
});

describe("tierFor", () => {
  it("is strong only when every criterion is solid and every check passes", () => {
    expect(tierFor(scores(STAR_CRITERIA, 4), checks())).toBe("strong");
    expect(tierFor(scores(STAR_CRITERIA, 4), checks({ filler: false }))).toBe("good_enough");
    const oneThree = [...scores(STAR_CRITERIA.slice(1), 4), { id: "context", score: 3, note: "" }];
    expect(tierFor(oneThree, checks())).toBe("strong");
    const oneTwo = [...scores(STAR_CRITERIA.slice(1), 4), { id: "context", score: 2, note: "" }];
    expect(tierFor(oneTwo, checks())).toBe("good_enough");
  });

  it("is not yet with a missing criterion, a low average, no number or an untraced number", () => {
    const oneMissing = [
      ...scores(STAR_CRITERIA.slice(1), 4),
      { id: "context", score: 1, note: "" },
    ];
    expect(tierFor(oneMissing, checks())).toBe("not_yet");
    expect(tierFor(scores(STAR_CRITERIA, 2), checks())).toBe("not_yet");
    expect(tierFor(scores(STAR_CRITERIA, 4), checks({ number: false }))).toBe("not_yet");
    expect(tierFor(scores(STAR_CRITERIA, 4), checks({ traced: false }))).toBe("not_yet");
    expect(tierFor([], checks())).toBe("not_yet");
  });
});

describe("combineGrade", () => {
  it("puts the quick-check fixes first, keeps two, and flags disagreements", () => {
    const grade = combineGrade({
      criteria: scores(STAR_CRITERIA, 3),
      checks: checks({ number: false, i_we: false }),
      modelFixes: ["Say what the CTO objected to.", "Cut the second paragraph."],
      bankRole: { role: "team-level impact", note: "Led one team." },
      storyType: stakeholder,
      model: "openai/gpt-5.5",
      draftWrittenAt: "2026-10-13T00:00:00Z",
    });
    expect(grade.tier).toBe("not_yet");
    expect(grade.fixes).toHaveLength(2);
    expect(grade.fixes[0]).toMatch(/Give the result a number/);
    expect(grade.fixes[1]).toBe("Say what the CTO objected to.");
    expect(grade.flags).toHaveLength(2);
    expect(grade.bankRole?.role).toBe("team-level impact");
  });

  it("leaves out the bank role for Tell me about yourself", () => {
    const grade = combineGrade({
      criteria: scores(INTRO_CRITERIA, 3),
      checks: checks(),
      modelFixes: [],
      bankRole: { role: "hands-on proof", note: "" },
      storyType: aboutMe,
      model: "m",
      draftWrittenAt: "t",
    });
    expect(grade.bankRole).toBeUndefined();
    expect(grade.tier).toBe("good_enough");
  });
});

describe("the grader's prompt and reply", () => {
  it("asks for every criterion, and a bank role only for behavioral stories", () => {
    const star = gradeSystem(stakeholder);
    for (const c of STAR_CRITERIA) expect(star).toContain(`- ${c.id} (${c.label})`);
    expect(star).toContain("bankRole");
    expect(star).toMatch(/Never suggest a specific number/);
    const intro = gradeSystem(aboutMe);
    for (const c of INTRO_CRITERIA) expect(intro).toContain(`- ${c.id} (${c.label})`);
    expect(intro).not.toContain("bankRole");
  });

  it("parses scores, fixes and bank role, rounding and dropping bad values", () => {
    const reply = `Here you go:\n\`\`\`json\n${JSON.stringify({
      criteria: {
        context: { score: 3, note: "Clear stakes.", improve: "Say what losing it would cost." },
        ownership: { score: "4", note: "Mostly I." },
        actions: { score: 2.4, note: "Vague." },
        result: { score: 4, note: "$2.4M.", improve: "Nothing." },
        reflection: { score: 1, note: "None." },
      },
      summary: "A clear save story with a strong number.",
      strengths: ["The $2.4M renewal lands.", "", "Clear stakes.", "Owns the plan.", "Fourth."],
      fixes: ["Add the lesson.", "", "Name the choice.", "Third."],
      bankRole: { role: "Team-level impact", note: "One team." },
    })}\n\`\`\``;
    const parsed = parseGrade(reply, stakeholder);
    expect(parsed.summary).toBe("A clear save story with a strong number.");
    expect(parsed.strengths).toEqual([
      "The $2.4M renewal lands.",
      "Clear stakes.",
      "Owns the plan.",
    ]);
    expect(parsed.criteria[0].improve).toBe("Say what losing it would cost.");
    // A top score has nothing to raise.
    expect(parsed.criteria[3].improve).toBeUndefined();
    expect(parsed.criteria.map((c) => c.score)).toEqual([3, 4, 2, 4, 1]);
    expect(parsed.fixes).toEqual(["Add the lesson.", "Name the choice."]);
    expect(parsed.bankRole).toEqual({ role: "team-level impact", note: "One team." });
  });

  it("rejects a reply missing a criterion or out of range", () => {
    expect(() => parseGrade('{"criteria": {"context": {"score": 3}}}', stakeholder)).toThrow(
      /left out/,
    );
    const bad = Object.fromEntries(STAR_CRITERIA.map((c) => [c.id, { score: 9 }]));
    expect(() => parseGrade(JSON.stringify({ criteria: bad }), stakeholder)).toThrow();
    expect(() => parseGrade("no json", stakeholder)).toThrow(/unexpected format/);
  });
});

describe("show your thinking", () => {
  const criteria = Object.fromEntries(STAR_CRITERIA.map((c) => [c.id, { score: 3, note: "Ok." }]));

  it("asks the grader for thinking feedback on behavioral stories only, kept out of the scores", () => {
    const star = gradeSystem(stakeholder);
    expect(star).toContain('"thinking"');
    expect(star).toMatch(/feedback only: don't let it change any score/);
    expect(gradeSystem(aboutMe)).not.toContain('"thinking"');
  });

  it("parses the feedback, and drops it rather than failing the grade when it's malformed", () => {
    const reply = (thinking: unknown) => JSON.stringify({ criteria, thinking });
    expect(
      parseGrade(
        reply({ level: "partly", note: "Says it cut scope.", improve: "Say why." }),
        stakeholder,
      ).thinking,
    ).toEqual({ level: "partly", note: "Says it cut scope.", improve: "Say why." });
    // Nothing to add once it's shown.
    expect(
      parseGrade(reply({ level: "shown", note: "Clear.", improve: "More." }), stakeholder).thinking,
    ).toEqual({ level: "shown", note: "Clear." });
    expect(parseGrade(reply({ level: "great" }), stakeholder).thinking).toBeUndefined();
    expect(parseGrade(reply(undefined), stakeholder).thinking).toBeUndefined();
  });

  it("never changes the tier, and round-trips through stories.content", () => {
    const input = {
      criteria: scores(STAR_CRITERIA, 4),
      checks: checks(),
      modelFixes: [],
      storyType: stakeholder,
      model: "m",
      draftWrittenAt: goodStar.writtenAt,
    };
    const without = combineGrade(input);
    const missing = combineGrade({
      ...input,
      thinking: { level: "missing", note: "Only lists steps.", improve: "Say why." },
    });
    expect(missing.tier).toBe(without.tier);
    expect(missing.fixes).toEqual(without.fixes);
    const content = parseContent(JSON.parse(JSON.stringify({ answers: {}, grade: missing })));
    expect(content.grade?.thinking).toEqual(missing.thinking);
    // About me has no key decision, so no thinking feedback.
    expect(combineGrade({ ...input, storyType: aboutMe, thinking: missing.thinking }).thinking)
      .toBeUndefined();
  });
});

describe("saved grades", () => {
  it("round-trips through stories.content and goes stale when the draft is rewritten", () => {
    const grade = combineGrade({
      criteria: scores(STAR_CRITERIA, 3),
      checks: checks(),
      modelFixes: ["Add the lesson."],
      storyType: stakeholder,
      model: "m",
      draftWrittenAt: goodStar.writtenAt,
    });
    const content = parseContent(
      JSON.parse(JSON.stringify({ answers: {}, draft: goodStar, grade })),
    );
    expect(content.grade).toEqual(grade);
    expect(gradeIsCurrent(content)).toBe(true);
    content.draft = { ...goodStar, writtenAt: "2026-10-14T00:00:00Z" };
    expect(gradeIsCurrent(content)).toBe(false);
    expect(parseContent({ grade: { tier: "excellent" } }).grade).toBeUndefined();
  });
});

describe("cutting the fluff", () => {
  it("flags figures said with an unsure hedge, but not labelled estimates", () => {
    expect(
      hedgedFigures(
        "It's still experimental, at maybe 100 accounts and 2 sellers, but I think 20% of reps use it.",
      ),
    ).toEqual(["maybe 100 accounts", "I think 20%"]);
    expect(hedgedFigures("We closed 40 deals or so last year.")).toEqual(["40 deals or so"]);
    expect(hedgedFigures("Probably around $2.4M in pipeline.")).toEqual(["Probably around $2.4M"]);
    expect(hedgedFigures("About 100 accounts, an estimated 20% lift, roughly $3B.")).toEqual([]);
    expect(hedgedFigures("Maybe that's why I moved.")).toEqual([]);
  });

  it("fails the hedged check and asks the user to firm the figure up", () => {
    const d = draft({ ...goodStar.parts, result: "We renewed it, maybe 100 accounts in all." });
    const grade = combineGrade({
      criteria: scores(STAR_CRITERIA, 4),
      checks: quickChecks(d, stakeholder),
      modelFixes: [],
      storyType: stakeholder,
      model: "test",
      draftWrittenAt: d.writtenAt,
    });
    expect(grade.checks.find((c) => c.id === "hedged")).toMatchObject({ pass: false });
    expect(grade.checks.find((c) => c.id === "hedged")?.detail).toContain("maybe 100 accounts");
    expect(grade.tier).not.toBe("strong");
    expect(grade.fixes[0]).toContain("Firm up");
  });

  it("holds Tell me about yourself to 60 to 90 seconds and a story to about two minutes", () => {
    expect(lengthRange(aboutMe)).toEqual({ min: 150, max: 225 });
    expect(lengthRange(stakeholder)).toEqual({ min: 180, max: 300 });
  });

  it("catches puffery as filler", () => {
    expect(fillerPhrases("I'm really passionate about the kind of work that matters.")).toEqual([
      "really",
      "passionate about",
      "the kind of",
    ]);
  });

  it("tells the grader to mark padding and unsure figures down", () => {
    expect(gradeSystem(aboutMe)).toContain("maybe 100 accounts");
  });
});

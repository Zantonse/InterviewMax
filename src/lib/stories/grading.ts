import type { ChatMessage } from "@/lib/ai/types";
import type { StoryDraft } from "./content";
import { parseStoredFit, type ContentCheck } from "./fit";
import { findNumbers } from "./numbers";
import { extractJson } from "./prompts";
import { INTRO_LENGTH, STAR_LENGTH, storyParts, type StoryType } from "./story-types";

// Grading a written story (PRD, quality gate). Two halves that run side by side:
//   quick checks: plain code, no judgment (a number in the result, every number traced, "I" against
//                 "we", spoken length, filler and vague phrases, unsure figures)
//   the grade:    a separate model call (storyGrade) scores each criterion 1 to 4
// The tier comes from both, in code. Where the quick checks and the grade disagree the story is
// flagged, which is a cheap built-in check on the grader.

export type Tier = "not_yet" | "good_enough" | "strong";

export const TIERS: { id: Tier; label: string }[] = [
  { id: "not_yet", label: "Not yet" },
  { id: "good_enough", label: "Good enough" },
  { id: "strong", label: "Strong" },
];

export type Criterion = { id: string; label: string; question: string };

// What the grader scores in a behavioral (STAR) story.
export const STAR_CRITERIA = [
  {
    id: "context",
    label: "Context",
    question: "Is it clear where you were, what your role was, and what was at stake?",
  },
  {
    id: "ownership",
    label: "Ownership",
    question: "Is what you did yourself clearly separated from what the team did?",
  },
  {
    id: "actions",
    label: "Actions and decisions",
    question: "Are the steps concrete, with a real choice between options and why you made it?",
  },
  {
    id: "result",
    label: "Result",
    question: "Is the outcome in real terms, with a number and the context that makes it land?",
  },
  {
    id: "reflection",
    label: "Reflection",
    question: "Is there a specific lesson, or something you'd do differently?",
  },
] as const satisfies readonly Criterion[];

// What the grader scores in "Tell me about yourself".
export const INTRO_CRITERIA = [
  {
    id: "present",
    label: "Where you are now",
    question: "Are your current role, company or industry, and scope clear, with a size?",
  },
  {
    id: "path",
    label: "How you got here",
    question: "Are the career moves that matter there, with why you made each one?",
  },
  {
    id: "highlight",
    label: "Proof",
    question: "Is there a result with a number and the context that makes it impressive?",
  },
  {
    id: "strengths",
    label: "What you're known for",
    question: "Is there something specific you're known for, backed by an example?",
  },
  {
    id: "next",
    label: "Why this next role",
    question: "Is it clear what you want next, why now, and how it follows from your path?",
  },
  {
    id: "thread",
    label: "One clear thread",
    question: "Does one thread tie the answer together, without detours that dilute it?",
  },
] as const satisfies readonly Criterion[];

export function gradingCriteria(storyType: StoryType | undefined): readonly Criterion[] {
  return storyType?.format === "intro" ? INTRO_CRITERIA : STAR_CRITERIA;
}

// The quick checks, in the order they're shown.
export const CHECKS = [
  { id: "number", label: "The result has a number" },
  { id: "traced", label: "Every number comes from your answers" },
  { id: "i_we", label: "“I” for what you did, not only “we”" },
  { id: "length", label: "Spoken length" },
  { id: "filler", label: "No filler or vague phrases" },
  { id: "hedged", label: "No unsure figures" },
] as const;

export type CheckId = (typeof CHECKS)[number]["id"];

export type CheckResult = { id: CheckId; pass: boolean; detail: string };

// Scores run 1 to 4.
export const SCORE_LABELS: Record<number, string> = {
  1: "Missing",
  2: "Thin",
  3: "Solid",
  4: "Strong",
};

export type CriterionScore = {
  id: string;
  score: number;
  // Why it got that score.
  note: string;
  // What would raise it, as what to do next. Empty when the score is 4.
  improve?: string;
};

// What a story does in the bank (PRD, level is judged across the bank, not as a pass or fail).
export const BANK_ROLES = [
  "hands-on proof",
  "team-level impact",
  "organization-level impact",
] as const;

export type StoryGrade = {
  tier: Tier;
  // The one or two things to do next, most important first.
  fixes: string[];
  // One sentence on how the story lands overall.
  summary?: string;
  // What already works, so the user knows what to keep.
  strengths: string[];
  criteria: CriterionScore[];
  checks: CheckResult[];
  // Behavioral stories only.
  bankRole?: { role: string; note: string };
  // Where a quick check and the grader's score disagree.
  flags: string[];
  // How the story fits the user's target jobs (see fit.ts). Missing with no target jobs, or when
  // the content check failed.
  content?: ContentCheck;
  model: string;
  // The draft this grade is for; a rewritten draft makes it stale.
  draftWrittenAt: string;
  gradedAt: string;
};

// The part that carries the story's number.
function numberPart(storyType: StoryType | undefined) {
  return storyType?.format === "intro" ? "highlight" : "result";
}

// Spoken length that suits each format (see INTRO_LENGTH and STAR_LENGTH).
export function lengthRange(storyType: StoryType | undefined): { min: number; max: number } {
  return storyType?.format === "intro" ? INTRO_LENGTH : STAR_LENGTH;
}

// Phrases that blur a spoken answer. Matched as whole words, case-insensitively.
export const FILLER_PHRASES = [
  "basically",
  "kind of",
  "sort of",
  "a lot of",
  "lots of",
  "various",
  "stuff",
  "things like that",
  "and so on",
  "etc",
  "helped with",
  "was responsible for",
  "was involved in",
  "worked on some",
  "some stuff",
  "synergy",
  "synergies",
  "leveraged",
  "very unique",
  "to be honest",
  "at the end of the day",
  "you know",
  "really",
  "truly",
  "incredibly",
  "passionate about",
  "the kind of",
  "a wide range of",
  "in terms of",
  "it's worth noting",
  "world-class",
  "best-in-class",
  "cutting-edge",
  "game-changer",
  "game-changing",
] as const;

// Words that make a figure sound unsure ("maybe 100 accounts"). A labelled estimate ("about",
// "roughly", "an estimated") is fine; these aren't, so the user firms the figure up or drops it.
const HEDGE_WORDS = [
  "maybe",
  "probably",
  "perhaps",
  "possibly",
  "potentially",
  "i think",
  "i believe",
  "i guess",
  "i'd say",
  "something like",
  "somewhere around",
];
const FIGURE = String.raw`[$€£]?\d[\d,.]*(?:%|x|k|mm|m|bn|b)?(?:\s+(?:thousand|million|billion))?`;
// The noun after a figure, e.g. "accounts" in "maybe 100 accounts", but not "of" or "in".
const UNIT = String.raw`(?:\s+(?!(?:of|in|on|at|to|for|and|or|but|with|the|a|an)\b)[a-z]+)?`;
const HEDGE_BEFORE_RE = new RegExp(
  String.raw`\b(?:${HEDGE_WORDS.map((w) => w.replace(/ /g, String.raw`\s+`)).join("|")})(?:\s+(?:at|of|around|about|like|over|under|nearly|almost|just|the|a|an))*\s+${FIGURE}${UNIT}`,
  "gi",
);
const HEDGE_AFTER_RE = new RegExp(
  String.raw`${FIGURE}${UNIT}\s+(?:or\s+so|give\s+or\s+take|if\s+that)\b`,
  "gi",
);

const FILLER_RE = new RegExp(
  `\\b(${FILLER_PHRASES.map((p) => p.replace(/ /g, "\\s+")).join("|")})\\b`,
  "gi",
);

export function draftText(parts: Record<string, string>, storyType: StoryType | undefined) {
  return storyParts(storyType)
    .map((p) => parts[p.id] ?? "")
    .filter(Boolean)
    .join("\n\n");
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// "I" against "we". Contractions count ("I'm", "we've"); "us"/"our" are left out so a story about
// a customer's team isn't penalized. "Me"/"my" count for "I".
export function pronounCounts(text: string): { i: number; we: number } {
  const i = (text.match(/\bI\b/g)?.length ?? 0) + (text.match(/\b(me|my|myself)\b/gi)?.length ?? 0);
  const we = text.match(/\bwe\b/gi)?.length ?? 0;
  return { i, we };
}

export function fillerPhrases(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(FILLER_RE)) found.add(m[1].toLowerCase().replace(/\s+/g, " "));
  return [...found];
}

// Figures said with an unsure hedge, as written, e.g. "maybe 100 accounts".
export function hedgedFigures(text: string): string[] {
  const found = new Set<string>();
  for (const re of [HEDGE_BEFORE_RE, HEDGE_AFTER_RE]) {
    for (const m of text.matchAll(re)) found.add(m[0].replace(/\s+/g, " ").replace(/[.,]$/, ""));
  }
  return [...found];
}

// The quick checks on a written draft. Plain code, no model call.
export function quickChecks(draft: StoryDraft, storyType: StoryType | undefined): CheckResult[] {
  return checkScript({
    text: draftText(draft.parts, storyType),
    numberText: draft.parts[numberPart(storyType)] ?? "",
    untraced: draft.untracedNumbers,
    range: lengthRange(storyType),
    where: storyType?.format === "intro" ? "your proof point" : "the result",
  });
}

// The same checks on any spoken script, e.g. "Tell me about yourself" for one target job.
export function checkScript(input: {
  text: string;
  // The part that should carry a number.
  numberText: string;
  untraced: string[];
  range: { min: number; max: number };
  where: string;
}): CheckResult[] {
  const { text, untraced, where } = input;
  const numbers = findNumbers(input.numberText, { includeCommonWords: false });
  const { i, we } = pronounCounts(text);
  const words = countWords(text);
  const { min, max } = input.range;
  const seconds = Math.round(((words / 150) * 60) / 5) * 5;
  const filler = fillerPhrases(text);
  const hedged = hedgedFigures(text);

  return [
    {
      id: "number",
      pass: numbers.length > 0,
      detail: numbers.length
        ? `${where[0].toUpperCase()}${where.slice(1)} includes ${numbers.map((n) => n.raw).join(", ")}.`
        : `There's no number in ${where}. Add one to your answers, or a labelled estimate.`,
    },
    {
      id: "traced",
      pass: untraced.length === 0,
      detail: untraced.length
        ? `Not in your answers: ${untraced.join(", ")}.`
        : "Nothing invented.",
    },
    {
      id: "i_we",
      pass: i > 0 && we <= i,
      detail: `“I” ${i} time${i === 1 ? "" : "s"}, “we” ${we} time${we === 1 ? "" : "s"}.`,
    },
    {
      id: "length",
      pass: words >= min && words <= max,
      detail: `${words} words, about ${formatSeconds(seconds)} spoken (aim for ${min} to ${max} words).`,
    },
    {
      id: "filler",
      pass: filler.length === 0,
      detail: filler.length ? `Found: ${filler.map((f) => `“${f}”`).join(", ")}.` : "None found.",
    },
    {
      id: "hedged",
      pass: hedged.length === 0,
      detail: hedged.length
        ? `${hedged.map((h) => `“${h}”`).join(", ")}: give the real figure, or drop it.`
        : "Every figure is said with confidence.",
    },
  ];
}

function formatSeconds(seconds: number) {
  if (seconds < 60) return `${seconds} seconds`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} min ${s} sec` : `${m} min`;
}

// The tier, from the grader's scores and the quick checks.
//   not yet:     any criterion missing, an average under 2.5, no number, or an untraced number
//   strong:      every criterion solid or better, an average of 3.5 or more, and every check passing
//   good enough: everything in between
export function tierFor(criteria: CriterionScore[], checks: CheckResult[]): Tier {
  const scores = criteria.map((c) => c.score);
  if (scores.length === 0) return "not_yet";
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const passed = (id: CheckId) => checks.find((c) => c.id === id)?.pass ?? false;

  if (!passed("number") || !passed("traced")) return "not_yet";
  if (Math.min(...scores) <= 1 || avg < 2.5) return "not_yet";
  if (Math.min(...scores) >= 3 && avg >= 3.5 && checks.every((c) => c.pass)) return "strong";
  return "good_enough";
}

// Where a quick check contradicts the grader. Shown on the story; the eval harness reads these too.
export function disagreements(
  criteria: CriterionScore[],
  checks: CheckResult[],
  storyType: StoryType | undefined,
): string[] {
  const flags: string[] = [];
  const score = (id: string) => criteria.find((c) => c.id === id)?.score ?? 0;
  const check = (id: CheckId) => checks.find((c) => c.id === id);
  const resultId = numberPart(storyType);
  const resultLabel = gradingCriteria(storyType).find((c) => c.id === resultId)?.label ?? "Result";

  if (score(resultId) >= 3 && check("number")?.pass === false) {
    flags.push(
      `The grader scored ${resultLabel} ${score(resultId)}, but the quick check found no number in it.`,
    );
  }
  if (storyType?.format !== "intro" && score("ownership") >= 3 && check("i_we")?.pass === false) {
    flags.push(
      `The grader scored Ownership ${score("ownership")}, but the story says “we” more than “I”.`,
    );
  }
  if (storyType?.format !== "intro" && score("ownership") <= 1 && check("i_we")?.pass === true) {
    flags.push("The grader scored Ownership 1, but the story mostly says “I”.");
  }
  return flags;
}

// Fixes the quick checks require, phrased as what to do next. These come before the grader's.
function checkFixes(checks: CheckResult[], storyType: StoryType | undefined): string[] {
  const failed = (id: CheckId) => checks.find((c) => c.id === id)?.pass === false;
  const fixes: string[] = [];
  if (failed("traced")) {
    fixes.push(
      "Check the highlighted figures: add them to an answer if they're real, or rewrite to drop them.",
    );
  }
  if (failed("hedged")) {
    fixes.push(
      "Firm up the unsure figures: check the real number in your records and add it to an answer, or drop it.",
    );
  }
  if (failed("number")) {
    fixes.push(
      storyType?.format === "intro"
        ? "Give your proof point a number: a result, its size, or a labelled estimate."
        : "Give the result a number: revenue, time saved, a percentage or a count, or a labelled estimate.",
    );
  }
  return fixes;
}

export function combineGrade(input: {
  criteria: CriterionScore[];
  checks: CheckResult[];
  modelFixes: string[];
  summary?: string;
  strengths?: string[];
  bankRole?: { role: string; note: string };
  content?: ContentCheck;
  storyType: StoryType | undefined;
  model: string;
  draftWrittenAt: string;
}): StoryGrade {
  const { criteria, checks, storyType } = input;
  const tier = tierFor(criteria, checks);
  const fixes = [...checkFixes(checks, storyType), ...input.modelFixes].slice(0, 2);
  return {
    tier,
    fixes,
    ...(input.summary ? { summary: input.summary } : {}),
    strengths: input.strengths ?? [],
    criteria,
    checks,
    ...(input.bankRole && storyType?.format !== "intro" ? { bankRole: input.bankRole } : {}),
    flags: disagreements(criteria, checks, storyType),
    ...(input.content ? { content: input.content } : {}),
    model: input.model,
    draftWrittenAt: input.draftWrittenAt,
    gradedAt: new Date().toISOString(),
  };
}

// The grader's prompt. Scores only; the tier is worked out in code.
export function gradeSystem(storyType: StoryType | undefined): string {
  const intro = storyType?.format === "intro";
  const criteria = gradingCriteria(storyType);
  return `You are a strict, fair interview coach grading ${
    intro
      ? `an experienced professional's answer to "Tell me about yourself"`
      : "an experienced professional's behavioral interview story"
  } as an interviewer would hear it. Grade the story as written; don't give credit for what it might mean. Padding, filler and unsure figures ("maybe 100 accounts") weaken an answer: score them down where they appear.

Score each criterion from 1 to 4:
1 = missing: an interviewer wouldn't find it.
2 = thin: it's there but vague, generic or unsupported.
3 = solid: clear and specific; an interviewer would be satisfied.
4 = strong: specific, memorable and backed by a number or concrete example; hard to improve.

Criteria:
${criteria.map((c) => `- ${c.id} (${c.label}): ${c.question}`).join("\n")}

For each criterion:
- note: one or two sentences (at most 40 words) on why it got that score, quoting or naming the specific part of the story. Say what works as well as what doesn't.
- improve: when the score is below 4, one sentence on the specific change that would raise it, addressed to the user. Leave it empty for a 4.

Write a one-sentence summary of how the story lands for an interviewer overall.

List the two or three things that already work best, so the user knows what to keep. Be specific: quote or name the line, number or example.

Then give the one or two changes that would most improve the story, most important first. Phrase each as what to do next, addressed to the user ("Say what…", "Add…"). Never suggest a specific number or invent a fact: when a number is missing, tell them to add the real one from their own records, or a labelled estimate.${
    intro
      ? ""
      : `

Also say which job this story does in a story bank: one of ${BANK_ROLES.map((r) => `"${r}"`).join(", ")}, with one short sentence on why. This describes the story's level; it is not a score.`
  }

Reply with JSON only, no other text:
{"summary": "…", "strengths": ["…"], "criteria": {${criteria.map((c) => `"${c.id}": {"score": 1, "note": "…", "improve": "…"}`).join(", ")}}, "fixes": ["…"]${
    intro ? "" : `, "bankRole": {"role": "…", "note": "…"}`
  }}`;
}

export function gradeMessages(
  title: string,
  draft: StoryDraft,
  storyType: StoryType | undefined,
): ChatMessage[] {
  return [
    {
      role: "user",
      content: `${storyType ? `Story type: ${storyType.label}\n` : ""}Title: ${title}\n\nGrade this story:\n\n${draftText(draft.parts, storyType)}`,
    },
  ];
}

export function parseGrade(
  text: string,
  storyType: StoryType | undefined,
): {
  criteria: CriterionScore[];
  fixes: string[];
  summary?: string;
  strengths: string[];
  bankRole?: { role: string; note: string };
} {
  const json = extractJson(text);
  if (!isRecord(json) || !isRecord(json.criteria)) {
    throw new Error("The grade came back in an unexpected format.");
  }
  const raw = json.criteria;
  const criteria = gradingCriteria(storyType).flatMap((c) => {
    const entry = raw[c.id];
    if (!isRecord(entry)) return [];
    const score = Math.round(Number(entry.score));
    if (!Number.isFinite(score) || score < 1 || score > 4) return [];
    const note = typeof entry.note === "string" ? entry.note.trim().slice(0, 400) : "";
    const improve =
      score < 4 && typeof entry.improve === "string" ? entry.improve.trim().slice(0, 300) : "";
    return [{ id: c.id, score, note, ...(improve ? { improve } : {}) }];
  });
  if (criteria.length !== gradingCriteria(storyType).length) {
    throw new Error("The grade left out some of the criteria.");
  }
  const fixes = stringList(json.fixes, 2);
  const strengths = stringList(json.strengths, 3);
  const summary = typeof json.summary === "string" ? json.summary.trim().slice(0, 300) : "";
  let bankRole: { role: string; note: string } | undefined;
  if (storyType?.format !== "intro" && isRecord(json.bankRole)) {
    const role =
      typeof json.bankRole.role === "string" ? json.bankRole.role.trim().toLowerCase() : "";
    if ((BANK_ROLES as readonly string[]).includes(role)) {
      const note =
        typeof json.bankRole.note === "string" ? json.bankRole.note.trim().slice(0, 300) : "";
      bankRole = { role, note };
    }
  }
  return {
    criteria,
    fixes,
    ...(summary ? { summary } : {}),
    strengths,
    ...(bankRole ? { bankRole } : {}),
  };
}

function stringList(value: unknown, max: number): string[] {
  return Array.isArray(value)
    ? value
        .filter((f): f is string => typeof f === "string" && f.trim().length > 0)
        .map((f) => f.trim().slice(0, 300))
        .slice(0, max)
    : [];
}

// Reads a saved grade defensively: stories.content is jsonb.
export function parseStoredGrade(raw: unknown): StoryGrade | undefined {
  if (!isRecord(raw)) return undefined;
  const tier = TIERS.find((t) => t.id === raw.tier)?.id;
  if (!tier || !Array.isArray(raw.criteria) || !Array.isArray(raw.checks)) return undefined;
  const strings = (v: unknown) =>
    Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    tier,
    fixes: strings(raw.fixes),
    ...(typeof raw.summary === "string" && raw.summary ? { summary: raw.summary } : {}),
    strengths: strings(raw.strengths),
    criteria: raw.criteria.filter(isRecord).flatMap((c) =>
      typeof c.id === "string" && typeof c.score === "number"
        ? [
            {
              id: c.id,
              score: c.score,
              note: str(c.note),
              ...(typeof c.improve === "string" && c.improve ? { improve: c.improve } : {}),
            },
          ]
        : [],
    ),
    checks: raw.checks.filter(isRecord).flatMap((c) => {
      const id = CHECKS.find((k) => k.id === c.id)?.id;
      return id && typeof c.pass === "boolean" ? [{ id, pass: c.pass, detail: str(c.detail) }] : [];
    }),
    ...(isRecord(raw.bankRole) && typeof raw.bankRole.role === "string"
      ? { bankRole: { role: raw.bankRole.role, note: str(raw.bankRole.note) } }
      : {}),
    flags: strings(raw.flags),
    ...(parseStoredFit(raw.content) ? { content: parseStoredFit(raw.content) } : {}),
    model: str(raw.model),
    draftWrittenAt: str(raw.draftWrittenAt),
    gradedAt: str(raw.gradedAt),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

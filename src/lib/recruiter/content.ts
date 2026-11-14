import { countWords } from "@/lib/stories/grading";
import { findNumbers, untracedNumbers } from "@/lib/stories/numbers";
import { OWN_WORDS_MIN } from "@/lib/stories/own-words";
import type { StoryType } from "@/lib/stories/story-types";

// "Recruiter version" (prep for each interview stage, Nov 14): the same written story told for a
// recruiter screen. A recruiter checks fit and is rarely an expert in the work, so it's short (under
// a minute), plain (no acronyms or insider words) and headline first: the result with its number,
// one line of context, and the candidate's part. Then the details to save for the hiring manager,
// so the candidate doesn't spend the screen on them. One model call (storyRecruiter, see make.ts);
// the checks, speaking time, own-words share and jargon list are code. It never changes the story
// or its score.

export type RecruiterVersion = {
  headline: string;
  context: string;
  part: string;
  // Two or three details from the story to hold back for the hiring manager.
  saveFor: string[];
  // Figures in the version that aren't in the user's answers. Should be empty.
  untracedNumbers: string[];
  // Share of the spoken lines in the user's own phrasing (see own-words.ts).
  ownWords: number;
  model: string;
  // The draft this was made from. Stale once the story is rewritten or edited.
  draftWrittenAt: string;
  madeAt: string;
};

// Under a minute at 150 words a minute.
export const RECRUITER_WORDS = { min: 45, max: 120 } as const;
export const MAX_HEADLINE_WORDS = 30;
export const MAX_SAVE_FOR = 3;
const WORDS_PER_MINUTE = 150;

// Short capitalised words most listeners know, so they don't count as jargon.
const PLAIN_ACRONYMS = new Set([
  "I",
  "AI",
  "US",
  "USA",
  "UK",
  "EU",
  "CEO",
  "CFO",
  "CTO",
  "COO",
  "VP",
  "HR",
  "IT",
  "PM",
  "OK",
  "TV",
  "PR",
  "Q1",
  "Q2",
  "Q3",
  "Q4",
]);

export function canRecruiter(storyType: StoryType | undefined): boolean {
  // "Tell me about yourself" has its own shape and per-job versions; tough answers are already short.
  return storyType?.format !== "intro";
}

export function recruiterIsCurrent(
  v: RecruiterVersion | undefined,
  draftWrittenAt: string | undefined,
): v is RecruiterVersion {
  return Boolean(v && draftWrittenAt && v.draftWrittenAt === draftWrittenAt);
}

export function recruiterText(v: Pick<RecruiterVersion, "headline" | "context" | "part">): string {
  return [v.headline, v.context, v.part]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");
}

export function recruiterSeconds(text: string): number {
  return Math.round(((countWords(text) / WORDS_PER_MINUTE) * 60) / 5) * 5;
}

// Acronyms and all-caps insider words a recruiter may not know (ETL, SLA, dbt-style all caps),
// once each, in the order they appear.
export function findJargon(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(/\b[A-Z][A-Z0-9&]{1,6}s?\b/g)) {
    const word = m[0].replace(/s$/, "");
    if (PLAIN_ACRONYMS.has(word) || found.includes(word)) continue;
    found.push(word);
  }
  return found;
}

function hasNumber(text: string): boolean {
  return findNumbers(text, { includeCommonWords: false }).length > 0;
}

export type RecruiterCheckId = "first" | "short" | "plain" | "yours";

export type RecruiterCheck = { id: RecruiterCheckId; passed: boolean; note: string };

export const RECRUITER_CHECK_LABELS: Record<RecruiterCheckId, string> = {
  first: "Headline first",
  short: "Under a minute",
  plain: "Plain words",
  yours: "Every number is yours",
};

export function recruiterChecks(
  v: Pick<RecruiterVersion, "headline" | "context" | "part">,
  ctx: { story: string; answers: string; untraced?: string[] },
): RecruiterCheck[] {
  const text = recruiterText(v);
  const words = countWords(text);
  const lead = hasNumber(v.headline);
  const untraced = ctx.untraced ?? untracedNumbers(text, ctx.answers);
  const jargon = findJargon(text);
  return [
    {
      id: "first",
      passed: lead || !hasNumber(ctx.story),
      note: lead
        ? "It opens with the result and its number."
        : hasNumber(ctx.story)
          ? "Open with the result and its number."
          : "Your story has no number for the result. One makes it stick: add it in the builder.",
    },
    {
      id: "short",
      passed: words <= RECRUITER_WORDS.max,
      note: `${words} words, about ${recruiterSeconds(text)} seconds out loud.`,
    },
    {
      id: "plain",
      passed: jargon.length === 0,
      note: jargon.length
        ? `A recruiter may not know “${jargon.join("”, “")}”. Say what it is in plain words.`
        : "No acronyms or insider words.",
    },
    {
      id: "yours",
      passed: untraced.length === 0,
      note: untraced.length
        ? `Check these figures, they aren't in your answers: ${untraced.join(", ")}.`
        : "Every figure comes from your answers.",
    },
  ];
}

// What's wrong with a version, in words the model can act on. Empty when it's good.
export function recruiterProblems(
  v: Pick<RecruiterVersion, "headline" | "context" | "part" | "saveFor">,
  ctx: { story: string; answers: string; ownWords: number },
): string[] {
  const problems: string[] = [];
  if (!v.headline.trim() || !v.context.trim() || !v.part.trim()) {
    problems.push('Write all three lines: "headline", "context" and "part".');
  }
  const text = recruiterText(v);
  const words = countWords(text);
  if (words > RECRUITER_WORDS.max) {
    problems.push(`The three lines are ${words} words together; keep them under ${RECRUITER_WORDS.max}.`);
  }
  if (countWords(v.headline) > MAX_HEADLINE_WORDS) {
    problems.push(`The headline is one sentence of at most ${MAX_HEADLINE_WORDS} words.`);
  }
  if (hasNumber(ctx.story) && !hasNumber(v.headline)) {
    problems.push("The headline must state the result with its number from the story.");
  }
  const untraced = untracedNumbers(`${text} ${v.saveFor.join(" ")}`, ctx.answers);
  if (untraced.length) {
    problems.push(
      `These figures aren't in the user's answers: ${untraced.join(", ")}. Use only figures they gave, exactly as written, or leave them out.`,
    );
  }
  const jargon = findJargon(text);
  if (jargon.length) {
    problems.push(
      `A recruiter may not know these: ${jargon.join(", ")}. Say what each is in plain words instead.`,
    );
  }
  if (ctx.ownWords < OWN_WORDS_MIN) {
    problems.push(
      "Too little of it is in the user's own words. Keep their phrasing from the story; cut and reorder rather than rephrase.",
    );
  }
  return problems;
}

export function parseSaveFor(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is string => typeof s === "string" && Boolean(s.trim()))
    .map((s) => s.trim().slice(0, 200))
    .slice(0, MAX_SAVE_FOR);
}

export function parseRecruiterVersion(raw: unknown): RecruiterVersion | undefined {
  if (!isRecord(raw)) return undefined;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const headline = str(raw.headline);
  if (!headline) return undefined;
  return {
    headline,
    context: str(raw.context),
    part: str(raw.part),
    saveFor: parseSaveFor(raw.saveFor),
    untracedNumbers: Array.isArray(raw.untracedNumbers)
      ? raw.untracedNumbers.filter((n): n is string => typeof n === "string")
      : [],
    ownWords: typeof raw.ownWords === "number" && raw.ownWords >= 0 ? Math.min(raw.ownWords, 1) : 0,
    model: str(raw.model),
    draftWrittenAt: str(raw.draftWrittenAt),
    madeAt: str(raw.madeAt),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

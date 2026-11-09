import { countWords } from "@/lib/stories/grading";
import { findNumbers, untracedNumbers } from "@/lib/stories/numbers";
import { OWN_WORDS_MIN } from "@/lib/stories/own-words";
import type { StoryType } from "@/lib/stories/story-types";

// "Exec version": the same written story told the way executives listen, answer first. One model
// call (storyExec, see make.ts) cuts the written story to three lines: the bottom line (the outcome
// and its number), why it mattered, and how you did it (the one key decision, opening with how you
// think about the problem when the story says). Then the details are held back for when they ask:
// two or three questions an executive would likely ask next, each answered from the story or left
// open when the story doesn't say. Everything else is code: the speaking time, the checks below,
// the share in the user's own words and the hedging words in the written story. It never changes
// the story or its score.
//
// It's the opposite order to "How to tell it" (src/lib/telling), which builds to the result like a
// storyteller. Use this one when the interviewer is a director or above, or says "the short version".

export type ExecAsk = {
  question: string;
  // From the story, or null when the story doesn't answer it (the user should have one ready).
  answer: string | null;
};

export type ExecVersion = {
  bottomLine: string;
  why: string;
  how: string;
  ifAsked: ExecAsk[];
  // Figures in the version that aren't in the user's answers. Should be empty.
  untracedNumbers: string[];
  // Share of the spoken lines in the user's own phrasing (see own-words.ts).
  ownWords: number;
  model: string;
  // The draft this was made from. Stale once the story is rewritten or edited.
  draftWrittenAt: string;
  madeAt: string;
};

// About 30 seconds at 150 words a minute, with room to breathe.
export const EXEC_WORDS = { min: 40, max: 80 } as const;
export const MAX_BOTTOM_LINE_WORDS = 30;
export const MAX_ASKS = 3;
const MAX_ASK_ANSWER_WORDS = 40;
const WORDS_PER_MINUTE = 150;

export function canExec(storyType: StoryType | undefined): boolean {
  // "Tell me about yourself" has its own shape and per-job versions.
  return storyType?.format !== "intro";
}

export function execIsCurrent(
  exec: ExecVersion | undefined,
  draftWrittenAt: string | undefined,
): exec is ExecVersion {
  return Boolean(exec && draftWrittenAt && exec.draftWrittenAt === draftWrittenAt);
}

// The three lines as they're said.
export function execText(v: Pick<ExecVersion, "bottomLine" | "why" | "how">): string {
  return [v.bottomLine, v.why, v.how].map((s) => s.trim()).filter(Boolean).join(" ");
}

export function execSeconds(text: string): number {
  return Math.round(((countWords(text) / WORDS_PER_MINUTE) * 60) / 5) * 5;
}

// Words and phrases that soften a point. Executives hear them as doubt, so the exec version leaves
// them out, and the card shows the ones the written story uses as habits to drop out loud.
export const HEDGES = [
  "i think",
  "i guess",
  "i feel like",
  "i believe",
  "kind of",
  "sort of",
  "maybe",
  "basically",
  "hopefully",
  "pretty much",
  "a little bit",
  "somewhat",
  "i would say",
] as const;

// "i think" as it's written: "I think".
export function hedgeLabel(hedge: string): string {
  return hedge.replace(/\bi\b/g, "I");
}

export type HedgeCount = { hedge: string; count: number };

// The hedges in a text, most used first.
export function findHedges(text: string): HedgeCount[] {
  const lower = ` ${text.toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9' ]+/g, " ")} `;
  const found: HedgeCount[] = [];
  for (const hedge of HEDGES) {
    const count = lower.split(` ${hedge} `).length - 1;
    if (count > 0) found.push({ hedge, count });
  }
  // Stable sort keeps the list order for ties.
  return found.sort((a, b) => b.count - a.count);
}

// Whether the story has a figure the bottom line could lead with.
export function storyHasNumber(story: string): boolean {
  return findNumbers(story, { includeCommonWords: false }).length > 0;
}

export type ExecCheckId = "first" | "short" | "flat" | "yours";

export type ExecCheck = { id: ExecCheckId; passed: boolean; note: string };

export const EXEC_CHECK_LABELS: Record<ExecCheckId, string> = {
  first: "Answer first",
  short: "About 30 seconds",
  flat: "No hedging",
  yours: "Every number is yours",
};

// The checks on an exec version, shown on the card and used to send the model back once.
export function execChecks(
  v: Pick<ExecVersion, "bottomLine" | "why" | "how">,
  // `untraced` is the saved list when shown on the card (it was checked against the numbers
  // checklist too); otherwise the figures are checked against `answers`.
  ctx: { story: string; answers: string; untraced?: string[] },
): ExecCheck[] {
  const text = execText(v);
  const words = countWords(text);
  const lineHasNumber = storyHasNumber(v.bottomLine);
  const untraced = ctx.untraced ?? untracedNumbers(text, ctx.answers);
  const hedges = findHedges(text);
  return [
    {
      id: "first",
      passed: lineHasNumber || !storyHasNumber(ctx.story),
      note: lineHasNumber
        ? "The first sentence is the result, with its number."
        : storyHasNumber(ctx.story)
          ? "The first sentence should be the result, with its number."
          : "Your story has no number for the result. Execs listen for one: add it in the builder.",
    },
    {
      id: "short",
      passed: words <= EXEC_WORDS.max,
      note: `${words} words, about ${execSeconds(text)} seconds out loud.`,
    },
    {
      id: "flat",
      passed: hedges.length === 0,
      note: hedges.length
        ? `Drop “${hedges.map((h) => hedgeLabel(h.hedge)).join("”, “")}”.`
        : "Said plainly, with nothing softening it.",
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
export function execProblems(
  v: Pick<ExecVersion, "bottomLine" | "why" | "how" | "ifAsked">,
  ctx: { story: string; answers: string; ownWords: number },
): string[] {
  const problems: string[] = [];
  if (!v.bottomLine.trim() || !v.why.trim() || !v.how.trim()) {
    problems.push('Write all three lines: "bottomLine", "why" and "how".');
  }
  const words = countWords(execText(v));
  if (words > EXEC_WORDS.max) {
    problems.push(`The three lines are ${words} words together; keep them under ${EXEC_WORDS.max}.`);
  }
  if (countWords(v.bottomLine) > MAX_BOTTOM_LINE_WORDS) {
    problems.push(`The bottom line is one sentence of at most ${MAX_BOTTOM_LINE_WORDS} words.`);
  }
  if (storyHasNumber(ctx.story) && !storyHasNumber(v.bottomLine)) {
    problems.push("The bottom line must state the result with its number from the story.");
  }
  const askText = v.ifAsked.map((a) => a.answer ?? "").join(" ");
  const untraced = untracedNumbers(`${execText(v)} ${askText}`, ctx.answers);
  if (untraced.length) {
    problems.push(
      `These figures aren't in the user's answers: ${untraced.join(", ")}. Use only figures they gave, exactly as written, or leave them out.`,
    );
  }
  const hedges = findHedges(execText(v));
  if (hedges.length) {
    problems.push(`Drop the hedging words: ${hedges.map((h) => `"${h.hedge}"`).join(", ")}.`);
  }
  if (ctx.ownWords < OWN_WORDS_MIN) {
    problems.push(
      "Too little of it is in the user's own words. Keep their phrasing from the story; cut and reorder rather than rephrase.",
    );
  }
  return problems;
}

export function parseExecAsks(raw: unknown): ExecAsk[] {
  if (!Array.isArray(raw)) return [];
  const asks: ExecAsk[] = [];
  for (const a of raw) {
    if (!isRecord(a) || typeof a.question !== "string" || !a.question.trim()) continue;
    const answer =
      typeof a.answer === "string" && a.answer.trim()
        ? clipWords(a.answer.trim(), MAX_ASK_ANSWER_WORDS)
        : null;
    asks.push({ question: a.question.trim().slice(0, 200), answer });
    if (asks.length === MAX_ASKS) break;
  }
  return asks;
}

function clipWords(text: string, max: number): string {
  const words = text.split(/\s+/);
  return words.length <= max ? text : `${words.slice(0, max).join(" ")}…`;
}

export function parseExecVersion(raw: unknown): ExecVersion | undefined {
  if (!isRecord(raw)) return undefined;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const bottomLine = str(raw.bottomLine);
  if (!bottomLine) return undefined;
  return {
    bottomLine,
    why: str(raw.why),
    how: str(raw.how),
    ifAsked: parseExecAsks(raw.ifAsked),
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

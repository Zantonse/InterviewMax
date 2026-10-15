import type { LikelyQuestion } from "@/lib/questions/content";
import { coverageFor } from "@/lib/questions/coverage";
import { gradeIsCurrent, type StoryContent } from "@/lib/stories/content";
import { countWords } from "@/lib/stories/grading";
import { findNumbers, untracedNumbers } from "@/lib/stories/numbers";
import { INTRO_LENGTH, STAR_LENGTH } from "@/lib/stories/story-types";

// Practice mode (PRD v0.3, P0): the user answers a target job's likely questions out loud, a
// skeptical interviewer asks one or two follow-ups aimed at the weakest part, and each answer gets
// feedback: how close it stayed to the saved story, what was missing, and time spoken against the
// target length. Kept on practice_sessions.items (jsonb). Rules here are plain code; the follow-ups
// and the feedback are model calls (see coach.ts).
//
// The pieces that don't depend on a target job (a question, its turns, the feedback) are shaped so
// other rehearsal flows, such as the tough-questions coach, can reuse them.

// Questions in one practice round. The PRD's "done when" is a five-question practice.
export const ROUND_SIZE = 5;
// Follow-ups the interviewer asks per question, at most.
export const MAX_FOLLOW_UPS = 2;
export const MAX_PRACTICE_ANSWER_LENGTH = 6000;
// Rounds kept per job; the oldest go first.
export const MAX_SESSIONS_PER_JOB = 20;

// About 150 words a minute, as everywhere else in the app.
export const WORDS_PER_MINUTE = 150;

// Why a question is in the round. Gaps and weaker stories come first (PRD).
export type PracticeReason =
  | "gap" // no story in the bank answers it
  | "unwritten" // a story is started but not written yet
  | "not_yet" // written, graded "Not yet"
  | "ungraded" // written, no grade for the current draft
  | "good_enough"
  | "strong";

const REASON_RANK: Record<PracticeReason, number> = {
  gap: 0,
  unwritten: 1,
  not_yet: 2,
  ungraded: 3,
  good_enough: 4,
  strong: 5,
};

export const REASON_LABELS: Record<PracticeReason, string> = {
  gap: "No story yet",
  unwritten: "Story not written yet",
  not_yet: "Story graded “Not yet”",
  ungraded: "Story not graded yet",
  good_enough: "Story good enough",
  strong: "Story strong",
};

// One exchange: the interviewer's question (the likely question first, then each follow-up) and
// what the user said.
export type PracticeTurn = {
  question: string;
  // Follow-ups only: the weak spot it probes, e.g. "result" or "role".
  gap?: string;
  answer?: string;
  // Seconds of talking, when it was recorded with the mic. Missing when typed.
  seconds?: number;
};

export type Closeness = "close" | "partly" | "drifted" | "no_story";

export const CLOSENESS_LABELS: Record<Closeness, string> = {
  close: "Stayed close to your story",
  partly: "Partly followed your story",
  drifted: "Drifted from your story",
  no_story: "No saved story to compare",
};

export type Timing = {
  // The first answer only: that's the one with a target length. Follow-up answers are short.
  seconds: number;
  // True when measured from the recording, false when worked out from the word count.
  measured: boolean;
  words: number;
  min: number;
  max: number;
};

// Something the user said that isn't in their saved story, quoted from what they said. Only added
// to the story when the user confirms it.
export type NewFact = {
  fact: string;
  quote: string;
  kept?: boolean;
};

export type PracticeFeedback = {
  // One sentence on how the answer landed.
  summary: string;
  closeness: Closeness;
  closenessNote: string;
  // What worked, so the user keeps it.
  landed: string[];
  // What was missing, most important first.
  missing: string[];
  // How the follow-ups went.
  followUpsNote: string;
  // Figures in the saved story the answer never said (code, not the model).
  numbersLeftOut: string[];
  timing: Timing;
  newFacts: NewFact[];
  model: string;
  givenAt: string;
};

export type PracticeItem = {
  question: string;
  theme: string;
  reason: PracticeReason;
  // The saved story that answers it, when there is one.
  storyId?: string;
  storyTitle?: string;
  turns: PracticeTurn[];
  // Set when the interviewer has no more follow-ups for this question.
  probeDone?: boolean;
  feedback?: PracticeFeedback;
  skipped?: boolean;
};

type StoryLike = {
  id: string;
  title: string;
  storyType: string | null;
  content: StoryContent;
};

// Why a question would be practiced, from the story that answers it.
export function reasonFor(
  coverage: ReturnType<typeof coverageFor>,
  stories: StoryLike[],
): PracticeReason {
  if (!coverage || coverage.kind === "build") return "gap";
  if (!coverage.drafted) return "unwritten";
  const story = stories.find((s) => s.id === coverage.storyId);
  if (!story || !gradeIsCurrent(story.content)) return "ungraded";
  return story.content.grade?.tier ?? "ungraded";
}

// The questions for one round: gaps and weaker stories first, then the rest in the order the job's
// likely questions rank them. Each comes with the story it should be answered with.
export function pickQuestions(
  questions: LikelyQuestion[],
  stories: StoryLike[],
  size = ROUND_SIZE,
): PracticeItem[] {
  return questions
    .map((q, index) => {
      const coverage = coverageFor(q.theme, stories);
      const reason = reasonFor(coverage, stories);
      const item: PracticeItem = {
        question: q.question,
        theme: q.theme,
        reason,
        ...(coverage?.kind === "story"
          ? { storyId: coverage.storyId, storyTitle: coverage.title }
          : {}),
        turns: [{ question: q.question }],
      };
      return { item, index, rank: REASON_RANK[reason] };
    })
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, size)
    .map((x) => x.item);
}

export function itemDone(item: PracticeItem): boolean {
  return Boolean(item.feedback || item.skipped);
}

// The first question not answered and given feedback yet, or -1 when the round is over.
export function currentItemIndex(items: PracticeItem[]): number {
  return items.findIndex((i) => !itemDone(i));
}

// What a question needs next:
//   answer:   a turn is waiting for the user's answer
//   probe:    the interviewer decides on a follow-up
//   feedback: no more follow-ups; feedback is due
//   done:     feedback given, or skipped
export type ItemStep = "answer" | "probe" | "feedback" | "done";

export function itemStep(item: PracticeItem): ItemStep {
  if (itemDone(item)) return "done";
  if (item.turns.some((t) => !t.answer?.trim())) return "answer";
  if (!item.probeDone && followUpCount(item) < MAX_FOLLOW_UPS) return "probe";
  return "feedback";
}

export function followUpCount(item: { turns: PracticeTurn[] }): number {
  return Math.max(0, item.turns.length - 1);
}

// The spoken length that suits a question, in words: about a minute for "Tell me about yourself",
// about two minutes for a behavioral story (see story-types.ts).
export function targetWords(theme: string): { min: number; max: number } {
  return theme === "about_you" ? INTRO_LENGTH : STAR_LENGTH;
}

export function wordsToSeconds(words: number): number {
  return Math.round((words / WORDS_PER_MINUTE) * 60);
}

// How long the first answer took against the target. Measured when recorded, otherwise worked out
// from the word count.
export function timingFor(turn: PracticeTurn, theme: string): Timing {
  const words = countWords(turn.answer ?? "");
  const range = targetWords(theme);
  const measured = typeof turn.seconds === "number" && turn.seconds > 0;
  return {
    seconds: measured ? Math.round(turn.seconds!) : wordsToSeconds(words),
    measured,
    words,
    min: wordsToSeconds(range.min),
    max: wordsToSeconds(range.max),
  };
}

export type TimingVerdict = "short" | "ok" | "long";

// A little slack either side: nobody is timing to the second.
export function timingVerdict(t: Timing): TimingVerdict {
  if (t.seconds < t.min * 0.85) return "short";
  if (t.seconds > t.max * 1.15) return "long";
  return "ok";
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} sec`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m} min ${rest} sec` : `${m} min`;
}

export function timingNote(t: Timing): string {
  const said = `${formatDuration(t.seconds)}${t.measured ? "" : " (estimated from the words)"}`;
  const aim = `aim for ${formatDuration(t.min)} to ${formatDuration(t.max)}`;
  switch (timingVerdict(t)) {
    case "short":
      return `${said}: on the short side; ${aim}.`;
    case "long":
      return `${said}: too long; ${aim}. Lead with the result and cut the setup.`;
    default:
      return `${said}: right in range (${aim.replace("aim for ", "")}).`;
  }
}

// Everything the user said for one question: the answer and the follow-up answers.
export function spokenText(item: { turns: PracticeTurn[] }): string {
  return item.turns
    .map((t) => t.answer?.trim() ?? "")
    .filter(Boolean)
    .join("\n");
}

// Figures in the saved story the user never said, once each, as the story writes them. Years
// ("since 2019") are context, not results.
export function numbersLeftOut(storyText: string, spoken: string): string[] {
  return untracedNumbers(storyText, spoken).filter((raw) => !/^(19|20)\d\d$/.test(raw));
}

// Lower case, letters and digits only, so a quote matches whatever punctuation the transcript has.
function squash(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9%$']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Keeps the new facts that are really the user's words: the quote must be in what they said, and
// every number in the fact must be in the quote. At most three.
export function checkNewFacts(facts: NewFact[], spoken: string): NewFact[] {
  const said = squash(spoken);
  const result: NewFact[] = [];
  for (const f of facts) {
    const quote = squash(f.quote);
    if (quote.length < 8 || !said.includes(quote)) continue;
    if (untracedNumbers(f.fact, f.quote).length > 0) continue;
    result.push({ fact: f.fact, quote: f.quote });
    if (result.length >= 3) break;
  }
  return result;
}

// Whether the user's answer had any figure in it at all, for the interviewer's hints.
export function hasFigure(text: string): boolean {
  return findNumbers(text, { includeCommonWords: false }).length > 0;
}

// Reads practice_sessions.items defensively: it is jsonb, so its shape isn't guaranteed.
export function parseItems(raw: unknown): PracticeItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).flatMap((r) => {
    if (typeof r.question !== "string" || typeof r.theme !== "string") return [];
    const turns = Array.isArray(r.turns)
      ? r.turns.filter(isRecord).flatMap((t) =>
          typeof t.question === "string"
            ? [
                {
                  question: t.question,
                  ...(typeof t.gap === "string" ? { gap: t.gap } : {}),
                  ...(typeof t.answer === "string" ? { answer: t.answer } : {}),
                  ...(typeof t.seconds === "number" ? { seconds: t.seconds } : {}),
                },
              ]
            : [],
        )
      : [];
    if (turns.length === 0) turns.push({ question: r.question });
    const reason = (Object.keys(REASON_RANK) as PracticeReason[]).find((k) => k === r.reason);
    const item: PracticeItem = {
      question: r.question,
      theme: r.theme,
      reason: reason ?? "gap",
      turns,
      ...(typeof r.storyId === "string" ? { storyId: r.storyId } : {}),
      ...(typeof r.storyTitle === "string" ? { storyTitle: r.storyTitle } : {}),
      ...(r.probeDone === true ? { probeDone: true } : {}),
      ...(r.skipped === true ? { skipped: true } : {}),
    };
    const feedback = parseStoredFeedback(r.feedback);
    if (feedback) item.feedback = feedback;
    return [item];
  });
}

const CLOSENESS: readonly Closeness[] = ["close", "partly", "drifted", "no_story"];

export function parseStoredFeedback(raw: unknown): PracticeFeedback | undefined {
  if (!isRecord(raw) || typeof raw.summary !== "string" || !isRecord(raw.timing)) return undefined;
  const t = raw.timing;
  return {
    summary: raw.summary,
    closeness: CLOSENESS.find((c) => c === raw.closeness) ?? "no_story",
    closenessNote: str(raw.closenessNote),
    landed: strings(raw.landed),
    missing: strings(raw.missing),
    followUpsNote: str(raw.followUpsNote),
    numbersLeftOut: strings(raw.numbersLeftOut),
    timing: {
      seconds: num(t.seconds),
      measured: t.measured === true,
      words: num(t.words),
      min: num(t.min),
      max: num(t.max),
    },
    newFacts: Array.isArray(raw.newFacts)
      ? raw.newFacts.filter(isRecord).flatMap((f) =>
          typeof f.fact === "string" && typeof f.quote === "string"
            ? [{ fact: f.fact, quote: f.quote, ...(f.kept === true ? { kept: true } : {}) }]
            : [],
        )
      : [],
    model: str(raw.model),
    givenAt: str(raw.givenAt),
  };
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import { isRecord } from "@/lib/jobs/content";
import { QUESTION_THEMES, getTheme, type QuestionThemeId } from "@/lib/questions/themes";
import type { ThemeCoverage, ThemeStatus } from "@/lib/stories/bank";
import { untracedNumbers } from "@/lib/stories/numbers";
import { getStoryType, type StoryTypeId } from "@/lib/stories/story-types";

// The story finder (PRD v0.3, P0): for someone facing a blank page, one model call reads their
// resume, LinkedIn profile and role map and suggests six to ten story moments, each tied to a line
// it quotes from them. Code checks every quote and number, so nothing points at work they didn't
// list. Tapping a moment starts the builder with it filled in, for them to confirm in their words.
// Kept on profiles.story_finder.

export const MIN_MOMENTS = 6;
export const MAX_MOMENTS = 10;

// "Tell me about yourself" isn't one moment, so it has no suggestions.
export const FINDER_THEMES = QUESTION_THEMES.filter((t) => t.id !== "about_you");

export type FinderSourceId = "resume" | "linkedin" | "role_map" | "answers";

export type FinderSource = { id: FinderSourceId; text: string };

export const SOURCE_LABELS: Record<FinderSourceId, string> = {
  resume: "your resume",
  linkedin: "your LinkedIn profile",
  role_map: "your role map",
  answers: "your answers",
};

// With no resume, three quick questions about recent work stand in for it.
export const QUICK_QUESTIONS = [
  {
    id: "recent",
    text: "What's your current or most recent role, and what do you spend most of your time on?",
  },
  {
    id: "project",
    text: "What's a project or piece of work from the last two years that took a lot of your time?",
  },
  {
    id: "hard",
    text: "What's something at work that was hard, changed suddenly or didn't go to plan?",
  },
] as const;

export const MAX_QUICK_ANSWER_LENGTH = 1500;

export type StoryMoment = {
  id: string;
  themeId: QuestionThemeId;
  storyType: StoryTypeId;
  // A short name for the moment, e.g. "The billing migration at Acme".
  moment: string;
  // What it could show, as a question, e.g. "a time you led through ambiguity?"
  question: string;
  // The line it comes from, copied word for word from the source.
  quote: string;
  source: FinderSourceId;
};

export type StoryFinder = {
  // Answers to QUICK_QUESTIONS, keyed by id.
  answers?: Record<string, string>;
  moments?: StoryMoment[];
  // What the moments were read from, so the page can tell when they're out of date.
  basis?: string;
  model?: string;
  foundAt?: string;
};

export function quickAnswerText(answers: Record<string, string> | undefined): string {
  return QUICK_QUESTIONS.map((q) => answers?.[q.id]?.trim() ?? "")
    .filter(Boolean)
    .join("\n");
}

// Changes whenever any source text changes.
export function finderBasis(sources: FinderSource[]): string {
  return sources.map((s) => `${s.id}:${hash(s.text)}`).join("|");
}

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Lowercase, straight quotes, bullets and runs of whitespace flattened, so a quote copied from a PDF
// with odd spacing still matches.
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[•▪●◦]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// A quote needs enough words to point at one line, not a stray phrase.
const MIN_QUOTE_LENGTH = 12;

export function quoteIsIn(quote: string, text: string): boolean {
  const q = normalizeForMatch(quote)
    .replace(/^["'-]+|["'.,;:-]+$/g, "")
    .trim();
  return q.length >= MIN_QUOTE_LENGTH && normalizeForMatch(text).includes(q);
}

// Keeps the model's suggestions that hold up in code: a known theme, a story type that answers it,
// a quote found word for word in one of the sources, and no number that isn't in that quote's
// source. Duplicates and anything past MAX_MOMENTS are dropped.
export function checkMoments(raw: unknown, sources: FinderSource[]): StoryMoment[] {
  if (!Array.isArray(raw)) return [];
  const moments: StoryMoment[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (moments.length >= MAX_MOMENTS) break;
    if (!isRecord(item)) continue;
    const theme = FINDER_THEMES.find((t) => t.id === item.theme);
    const moment = str(item.moment);
    const question = str(item.question);
    const quote = str(item.quote);
    if (!theme || !moment || !quote) continue;

    const types: readonly string[] = theme.storyTypes;
    const storyType = (
      typeof item.storyType === "string" && types.includes(item.storyType)
        ? item.storyType
        : theme.storyTypes[0]
    ) as StoryTypeId;
    if (!getStoryType(storyType)) continue;

    // The named source first, then any other, since a line can appear in both resume and LinkedIn.
    const ordered = [
      ...sources.filter((s) => s.id === item.source),
      ...sources.filter((s) => s.id !== item.source),
    ];
    const source = ordered.find((s) => quoteIsIn(quote, s.text));
    if (!source) continue;
    if (untracedNumbers(`${moment}\n${question}`, source.text).length > 0) continue;

    const key = normalizeForMatch(moment);
    if (seen.has(key)) continue;
    seen.add(key);
    moments.push({
      id: `m${moments.length + 1}`,
      themeId: theme.id,
      storyType,
      moment: moment.replace(/[.:]+$/, ""),
      question,
      quote,
      source: source.id,
    });
  }
  return moments;
}

export type MomentGroup = {
  themeId: QuestionThemeId;
  label: string;
  status: ThemeStatus;
  moments: StoryMoment[];
};

// The moments by theme, themes with no story yet first, then in the usual theme order.
export function groupMoments(moments: StoryMoment[], coverage: ThemeCoverage[]): MomentGroup[] {
  const groups = FINDER_THEMES.flatMap((theme) => {
    const mine = moments.filter((m) => m.themeId === theme.id);
    if (mine.length === 0) return [];
    const status = coverage.find((c) => c.id === theme.id)?.status ?? "empty";
    return [{ themeId: theme.id, label: theme.label, status, moments: mine }];
  });
  return [
    ...groups.filter((g) => g.status === "empty"),
    ...groups.filter((g) => g.status !== "empty"),
  ];
}

export function parseFinder(raw: unknown): StoryFinder | null {
  if (!isRecord(raw)) return null;
  const finder: StoryFinder = {};
  if (isRecord(raw.answers)) {
    finder.answers = Object.fromEntries(
      Object.entries(raw.answers).filter((e): e is [string, string] => typeof e[1] === "string"),
    );
  }
  if (Array.isArray(raw.moments)) {
    finder.moments = raw.moments.filter(isRecord).flatMap((m) => {
      const theme = getTheme(str(m.themeId));
      const type = getStoryType(str(m.storyType));
      const source = str(m.source) as FinderSourceId;
      if (!theme || !type || !str(m.moment) || !(source in SOURCE_LABELS)) return [];
      return [
        {
          id: str(m.id),
          themeId: theme.id,
          storyType: type.id,
          moment: str(m.moment),
          question: str(m.question),
          quote: str(m.quote),
          source,
        },
      ];
    });
  }
  if (typeof raw.basis === "string") finder.basis = raw.basis;
  if (typeof raw.model === "string") finder.model = raw.model;
  if (typeof raw.foundAt === "string") finder.foundAt = raw.foundAt;
  return finder;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

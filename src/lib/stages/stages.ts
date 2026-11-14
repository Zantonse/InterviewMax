import type { AudienceId } from "@/lib/ask/content";
import { ROUNDS, isRound, type RoundId } from "@/lib/bank/content";
import type { QuestionThemeId } from "@/lib/questions/themes";
import type { ToughQuestionId } from "@/lib/tough/questions";

// Prep for each interview stage (Nov 11): a recruiter screen and a hiring manager interview check
// different things, so the brief, the warm-up and practice put that stage's questions, answers and
// questions to ask first. The stage is the one the user set on the job ("next stage"), else the one
// the interview timeline expects next. Rules in code, no model call.

export type StageGuide = {
  id: RoundId;
  label: string;
  // What this stage is checking, in one line.
  checks: string;
  // How to answer at this stage, a few short lines.
  tips: string[];
  // Question themes this stage asks most, most likely first. Empty means no reordering.
  themes: QuestionThemeId[];
  // How many likely questions the brief shows.
  questions: number;
  // Who the user's questions to ask should suit, first match first.
  audiences: AudienceId[];
  // Tough questions that come up at this stage, most likely first.
  tough: ToughQuestionId[];
};

export const STAGE_GUIDES: Record<RoundId, StageGuide> = {
  recruiter: {
    id: "recruiter",
    label: "Recruiter screen",
    checks:
      "Whether you fit the role on paper, want this job and fit the pay and timing. It's a filter, not a deep dive.",
    tips: [
      "Keep each answer to about a minute: the headline and the result, not the whole story.",
      "Lead with About me and why this company. Most screens open with both.",
      "Have your reason for leaving, your pay range and your timing ready in one sentence each.",
      'Save the detail for the hiring manager. "Happy to go deeper on that" is a fine ending.',
    ],
    themes: ["about_you", "success", "impact", "ai_use"],
    questions: 5,
    audiences: ["recruiter"],
    tough: [
      "why_leaving",
      "salary",
      "ai_at_work",
      "gap",
      "many_moves",
      "let_go",
    ],
  },
  hiring_manager: {
    id: "hiring_manager",
    label: "Hiring manager",
    checks:
      "Whether you can do this job on their team: how you think, what you owned and what changed because of you.",
    tips: [
      "Tell the full story in about two minutes: the stake, your actions, the result with its number.",
      "Say how you thought about the hard call, not only what you did.",
      "Expect follow-ups on the hardest part and on what you'd do differently.",
      "Connect at least one story to the problem their team has right now.",
    ],
    themes: [
      "impact",
      "ownership",
      "prioritization",
      "conflict",
      "failure",
      "influence",
      "ambiguity",
      "collaboration",
      "success",
      "about_you",
    ],
    questions: 8,
    audiences: ["hiring_manager", "peer"],
    tough: ["weakness", "failure", "ai_at_work", "why_leaving"],
  },
  panel: {
    id: "panel",
    label: "Panel or loop",
    checks:
      "How you work with others: each interviewer usually owns one area, so cover a range of stories.",
    tips: [
      "Use a different story for each interviewer where you can; they compare notes.",
      "Keep your About me and the facts in your stories the same in every room.",
      "Have a story ready for disagreement, cross-team work and a time it went wrong.",
    ],
    themes: [
      "collaboration",
      "conflict",
      "influence",
      "ownership",
      "failure",
      "impact",
      "ambiguity",
      "prioritization",
    ],
    questions: 8,
    audiences: ["peer", "hiring_manager"],
    tough: ["failure", "weakness", "ai_at_work"],
  },
  final: {
    id: "final",
    label: "Final round",
    checks:
      "Whether you'll succeed here at this level, often with a senior leader: judgment, scope and why you.",
    tips: [
      "Lead with the result and the scope. Leaders want the headline before the detail.",
      "Have a clear answer to why this company and what you'd do in your first 90 days.",
      "Bring one story about a hard tradeoff and how you decided.",
    ],
    themes: [
      "success",
      "impact",
      "ambiguity",
      "influence",
      "prioritization",
      "about_you",
    ],
    questions: 6,
    audiences: ["executive", "hiring_manager"],
    tough: ["weakness", "salary", "ai_at_work"],
  },
  other: {
    id: "other",
    label: "Another round",
    checks: "",
    tips: [],
    themes: [],
    questions: 8,
    audiences: [],
    tough: [],
  },
};

// The stages the user can pick, in the order they usually happen.
export const STAGES = ROUNDS.map((r) => STAGE_GUIDES[r.id]);

export function isStage(id: unknown): id is RoundId {
  return isRound(id);
}

// The stage to prep for: the one the user set, else the timeline's guess. Both may be null.
export function stageFor(
  set: string | null | undefined,
  guessed: RoundId | null | undefined,
): { id: RoundId; guessed: boolean } | null {
  if (isStage(set)) return { id: set, guessed: false };
  if (guessed) return { id: guessed, guessed: true };
  return null;
}

type Staged = { theme: string; stages?: readonly string[] };

// Whether a list's questions carry the stages they're asked at (predicted since Nov 14). Older
// lists don't, apart from a default question or two, and are placed by theme.
function isTagged(items: Staged[]): boolean {
  return items.filter((i) => i.stages?.length).length * 2 >= items.length && items.length > 0;
}

// Whether one question belongs to this stage: by its stage tags when the list has them, else by
// whether its theme is one the stage asks most.
function inStage(item: Staged, stage: RoundId, tagged: boolean): boolean {
  if (tagged && item.stages?.length) return item.stages.includes(stage);
  return (STAGE_GUIDES[stage].themes as string[]).includes(item.theme);
}

// Puts the questions this stage asks first, keeping the rest in their original order after them.
// Tagged lists: questions whose main stage is this one, then those that list it second, each in
// the predicted order. Older lists: by the stage's themes, in the stage's order. With no stage, or
// another round, nothing moves.
export function orderForStage<T extends Staged>(items: T[], stage: RoundId | null): T[] {
  const themes = stage ? (STAGE_GUIDES[stage].themes as string[]) : [];
  if (!stage || !themes.length) return items;
  const tagged = isTagged(items);
  const themeRank = (t: string) => {
    const i = themes.indexOf(t);
    return i === -1 ? themes.length : i;
  };
  const group = (item: T) => {
    if (!inStage(item, stage, tagged)) return 2;
    return tagged && item.stages?.length && item.stages[0] !== stage ? 1 : 0;
  };
  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        group(a.item) - group(b.item) ||
        (tagged ? 0 : themeRank(a.item.theme) - themeRank(b.item.theme)) ||
        a.index - b.index,
    )
    .map((x) => x.item);
}

// The likely questions for a practice round at this stage: only the stage's own when there are at
// least `min` of them, so a recruiter-screen round doesn't drill conflict stories; else all,
// stage's first.
export function questionsForStage<T extends Staged>(
  items: T[],
  stage: RoundId | null,
  min = 3,
): T[] {
  const ordered = orderForStage(items, stage);
  if (!stage || !STAGE_GUIDES[stage].themes.length) return ordered;
  const tagged = isTagged(items);
  const mine = ordered.filter((q) => inStage(q, stage, tagged));
  return mine.length >= min ? mine : ordered;
}

// How many of a job's likely questions this stage asks.
export function stageCount(items: Staged[], stage: RoundId): number {
  const tagged = isTagged(items);
  return items.filter((q) => inStage(q, stage, tagged)).length;
}

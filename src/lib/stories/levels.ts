// Story levels (Craig, 2026-11-11, from a friend's idea): people who don't yet know what makes a
// strong interview story start from the one they told and climb, one idea at a time.
//   Level 1, "It happened":             the rough draft. Reached as soon as the story is told.
//   Level 2, "It proves something":     the Good enough tier. Clear stakes, what you did, a number.
//   Level 3, "It shows how you think":  the Strong tier, plus "show your thinking" at the key
//                                        decision (Craig chose to count it here, 2026-11-11).
// Levels are how a behavioral story's grade is shown; the tier (tierFor in grading.ts) is still
// worked out the same way underneath. "Tell me about yourself" and tough questions keep the tiers.
// Level 4, "Ready to say out loud" (practiced aloud, handled a follow-up), is planned for later.

import type { StoryContent } from "./content";
import {
  CHECKS,
  STAR_CRITERIA,
  TIER_SCORE_CAP,
  belowLevel,
  scoreOutOf100,
  type CheckId,
  type StoryGrade,
} from "./grading";
import type { StoryType } from "./story-types";

export type StoryLevel = 1 | 2 | 3;

export const TOP_LEVEL: StoryLevel = 3;

export type LevelInfo = {
  level: StoryLevel;
  name: string;
  // What an interviewer hears at this level.
  hears: string;
  // The one idea to learn to get here from the level below, addressed to the user.
  lesson: string;
};

export const LEVELS: readonly LevelInfo[] = [
  {
    level: 1,
    name: "It happened",
    hears:
      "What happened, in order. An interviewer can follow it, but can't yet tell what you did yourself or why it mattered.",
    lesson: "Tell it your way. Getting the story out is the first step.",
  },
  {
    level: 2,
    name: "It proves something",
    hears:
      "What was at stake, what you did yourself, and a result with a number. Good enough to use in an interview.",
    lesson:
      "Interviewers listen for proof. Make the stakes clear, say “I” for what you did, and end on a result with a number.",
  },
  {
    level: 3,
    name: "It shows how you think",
    hears:
      "How you think: the moment you had to choose, the options you weighed, why you picked one, and what you'd carry forward. This is what makes an answer stand out.",
    lesson:
      "Interviewers want to see how you think, not only what happened. Name the key decision, the options you weighed, why you chose, and what you learned.",
  },
];

export function levelInfo(level: StoryLevel): LevelInfo {
  return LEVELS[level - 1];
}

// Behavioral stories climb levels; About me and tough questions keep the tiers.
export function usesLevels(storyType: StoryType | undefined, content?: StoryContent): boolean {
  return storyType?.format === "star" && !content?.tough;
}

// The level a grade puts a behavioral story at.
export function levelForGrade(grade: StoryGrade): StoryLevel {
  if (grade.tier === "not_yet") return 1;
  if (grade.tier === "good_enough") return 2;
  // Strong, but the thinking at the key decision isn't shown yet: still Level 2. Grades from before
  // the thinking check was added have none, and aren't held back for it.
  return !grade.thinking || grade.thinking.level === "shown" ? 3 : 2;
}

// Where the story stands now: undefined until there's a draft (or for stories that don't use
// levels). A draft with no current grade is Level 1 until it's graded.
export function storyLevel(
  content: StoryContent,
  storyType: StoryType | undefined,
): StoryLevel | undefined {
  if (!usesLevels(storyType, content) || !content.draft) return undefined;
  const grade =
    content.grade?.draftWrittenAt === content.draft.writtenAt ? content.grade : undefined;
  return grade ? levelForGrade(grade) : 1;
}

// The score out of 100 can't run ahead of the level: a Strong story held at Level 2 for its
// thinking tops out where Good enough does.
export function levelScore(grade: StoryGrade): number | undefined {
  const score = scoreOutOf100(grade.criteria, grade.tier);
  if (score === undefined) return undefined;
  return levelForGrade(grade) === 2 ? Math.min(score, TIER_SCORE_CAP.good_enough) : score;
}

// One thing standing between the story and the next level.
//   gap:  the follow-up gap it asks about (see GAPS in prompts.ts), or undefined when only a
//         rewrite can fix it (length, filler…)
export type LevelGap = {
  id: string;
  gap?: string;
  label: string;
  detail: string;
};

// How many gaps one level-up works on: a short list keeps it one idea at a time.
export const MAX_LEVEL_GAPS = 3;

// Criterion id -> follow-up gap.
const CRITERION_GAP: Record<string, string> = {
  context: "situation",
  ownership: "ownership",
  actions: "actions",
  result: "result",
  reflection: "reflection",
};

// Quick check -> follow-up gap, for the checks an answer can fix. The rest only need a rewrite.
const CHECK_GAP: Partial<Record<CheckId, string>> = {
  number: "result",
  traced: "result",
  i_we: "ownership",
  hedged: "result",
};

const CORE_FOR_LEVEL_2 = new Set(["context", "ownership", "actions", "result"]);

// What the story needs to reach the next level, most important first. Empty at the top level.
export function levelGaps(grade: StoryGrade): LevelGap[] {
  const level = levelForGrade(grade);
  if (level >= TOP_LEVEL) return [];
  const gaps: LevelGap[] = [];
  const failed = (id: CheckId) => grade.checks.find((c) => c.id === id && !c.pass);
  const checkLabel = (id: CheckId) => CHECKS.find((c) => c.id === id)?.label ?? id;
  const criterionLabel = (id: string) => STAR_CRITERIA.find((c) => c.id === id)?.label ?? id;
  const byScore = [...grade.criteria].sort((a, b) => a.score - b.score);

  if (level === 1) {
    for (const id of ["number", "traced"] as const) {
      const check = failed(id);
      if (check)
        gaps.push({
          id,
          gap: CHECK_GAP[id],
          label: checkLabel(id),
          detail: check.detail,
        });
    }
    for (const c of byScore) {
      if (!CORE_FOR_LEVEL_2.has(c.id) || c.score > 2) continue;
      gaps.push({
        id: c.id,
        gap: CRITERION_GAP[c.id],
        label: criterionLabel(c.id),
        detail: c.improve || c.note,
      });
    }
    return dedupe(gaps).slice(0, MAX_LEVEL_GAPS);
  }

  // Level 2 to 3: the thinking first (it's what this level is about), then any part still under
  // Solid, then the scope the job expects, then whatever only a rewrite can fix.
  if (grade.thinking && grade.thinking.level !== "shown") {
    gaps.push({
      id: "thinking",
      gap: "decision",
      label: "Your thinking at the key decision",
      detail:
        grade.thinking.improve ||
        "Say what you noticed, the options you weighed, and why you chose the one you did.",
    });
  }
  for (const c of byScore) {
    if (c.score >= 3) continue;
    gaps.push({
      id: c.id,
      gap: CRITERION_GAP[c.id],
      label: criterionLabel(c.id),
      detail: c.improve || c.note,
    });
  }
  const below = belowLevel(grade.content);
  if (below) {
    const name = below.company ? `${below.title} at ${below.company}` : below.title;
    gaps.push({
      id: "scope",
      gap: "actions",
      label: "The scope the job expects",
      detail: `Show what you decided or changed beyond your own work, the scope ${name} expects, if that's true.`,
    });
  }
  for (const check of grade.checks) {
    if (check.pass) continue;
    gaps.push({
      id: check.id,
      gap: CHECK_GAP[check.id],
      label: checkLabel(check.id),
      detail: check.detail,
    });
  }
  // Every part Solid and every check passing, but the average is short of Strong: the weakest
  // parts that aren't Strong yet.
  if (gaps.length === 0) {
    for (const c of byScore) {
      if (c.score >= 4) continue;
      gaps.push({
        id: c.id,
        gap: CRITERION_GAP[c.id],
        label: criterionLabel(c.id),
        detail: c.improve || c.note,
      });
    }
  }
  return dedupe(gaps).slice(0, MAX_LEVEL_GAPS);
}

// Whether answering a question could close any of these gaps (if not, a rewrite is the way up).
export function needsAnswers(gaps: LevelGap[]): boolean {
  return gaps.some((g) => g.gap);
}

function dedupe(gaps: LevelGap[]): LevelGap[] {
  const seen = new Set<string>();
  return gaps.filter((g) => (seen.has(g.id) ? false : (seen.add(g.id), true)));
}

// A level-up the user started: where the story was, the level they're climbing to, and the draft
// before, for the before-and-after once it's rewritten and graded. `reached` is set by the grade
// that follows; the card stays until they close it.
export type LevelUp = {
  from: StoryLevel;
  target: StoryLevel;
  before: Record<string, string>;
  startedAt: string;
  // The follow-up round its questions were asked in, if any.
  round?: number;
  reached?: StoryLevel;
};

export function parseLevelUp(raw: unknown): LevelUp | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const lvl = (v: unknown): StoryLevel | undefined =>
    v === 1 || v === 2 || v === 3 ? v : undefined;
  const from = lvl(r.from);
  const target = lvl(r.target);
  if (!from || !target || typeof r.before !== "object" || r.before === null) return undefined;
  const before = Object.fromEntries(
    Object.entries(r.before as Record<string, unknown>).filter(
      (e): e is [string, string] => typeof e[1] === "string",
    ),
  );
  const reached = lvl(r.reached);
  return {
    from,
    target,
    before,
    startedAt: typeof r.startedAt === "string" ? r.startedAt : "",
    ...(typeof r.round === "number" ? { round: r.round } : {}),
    ...(reached ? { reached } : {}),
  };
}

// The probe instructions for a level-up round: questions aimed only at what stands between the
// story and the next level. Replaces the usual round instructions.
export function levelUpInstructions(target: StoryLevel, gaps: LevelGap[], round: number): string {
  const info = levelInfo(target);
  const asks = gaps.filter((g) => g.gap);
  const lines = asks.map((g) => `- ${g.label} (gap "${g.gap}"): ${g.detail}`);
  return `This is round ${round}, after the story was written and graded. The user is working their story up to Level ${target}, "${info.name}": ${info.hears}
Ask only about what stands between this story and that level:
${lines.join("\n")}
${asks.length <= 1 ? "Ask exactly one question" : `Ask 1 to ${Math.min(3, asks.length)} questions, one per item above`}, most important first, in one or two short sentences each. Each question's gap is the one given for its item. Build on what they already said, and never ask for something they already answered.${
    target === 3
      ? " For their thinking, ask about the real moment of choice: what they noticed, which options they had, and why they picked theirs. Never suggest options they didn't have."
      : ""
  } If their answers already cover an item, skip it; if they cover all of them, return an empty list: {"followUps": []}.`;
}

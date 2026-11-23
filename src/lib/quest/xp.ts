// Story Quest (Craig, 2026-11-23): a game section where XP only comes from making stories better.
// Opening the app, streaks and time spent earn nothing; most of the XP sits on Level 2 and Level 3,
// because the hard part is finishing a behavioral story. Everything here is worked out in code from
// what the app already saves (stories and their grades, practice rounds, past interviews), so there
// is no XP table to keep in step: a regrade that moves a story moves its XP with it.
//
// Plain logic, safe to import in client components.

import type { PracticeItem } from "@/lib/practice/content";
import type { StoryContent } from "@/lib/stories/content";
import { storyLevel, type StoryLevel } from "@/lib/stories/levels";
import { getStoryType } from "@/lib/stories/story-types";

// Level 4, "Ready to say out loud": a Level 3 story told in a practice round, with at least one of
// the interviewer's follow-ups answered, and an answer that stayed close to the saved story.
export type QuestLevel = 0 | StoryLevel | 4;

export const QUEST_TOP: QuestLevel = 4;

export const QUEST_LEVEL_NAMES: Record<QuestLevel, string> = {
  0: "Not written yet",
  1: "It happened",
  2: "It proves something",
  3: "It shows how you think",
  4: "Ready to say out loud",
};

// XP for each level a story reaches. One story from Level 1 to Level 4 is worth 500.
export const LEVEL_XP: Record<Exclude<QuestLevel, 0>, number> = { 1: 50, 2: 100, 3: 200, 4: 150 };

// A skill (skills.ts) that reaches Learned: shown in two stories, one of them unaided.
export const SKILL_LEARNED_XP = 100;
// A job's boss round, run to the end (boss.ts).
export const BOSS_XP = 300;
// A real interview added under Past interviews and read by the app.
export const INTERVIEW_XP = 75;

export type QuestStory = {
  id: string;
  title: string;
  storyType: string | null;
  content: StoryContent;
  updatedAt?: string;
};

export type QuestSession = {
  id?: string;
  targetJobId: string;
  items: PracticeItem[];
  finishedAt?: string | null;
};

// Behavioral stories are the ones that climb levels; About me and tough questions keep tiers.
export function isQuestStory(story: QuestStory): boolean {
  return getStoryType(story.storyType)?.format === "carl" && !story.content.tough;
}

// A practice answer that counts toward Level 4: the story was the one answered with, the feedback
// came back, at least one follow-up got an answer, and the telling didn't drift from the story.
export function heldUpInPractice(item: PracticeItem): boolean {
  if (!item.feedback || item.skipped) return false;
  if (item.feedback.closeness !== "close" && item.feedback.closeness !== "partly") return false;
  return item.turns.slice(1).some((t) => Boolean(t.answer?.trim()));
}

// The stories that held up in practice at least once.
export function storiesSaidOutLoud(sessions: readonly QuestSession[]): Set<string> {
  const out = new Set<string>();
  for (const s of sessions) {
    for (const item of s.items) {
      if (item.storyId && heldUpInPractice(item)) out.add(item.storyId);
    }
  }
  return out;
}

export function questLevel(story: QuestStory, saidOutLoud: ReadonlySet<string>): QuestLevel {
  if (!isQuestStory(story)) return 0;
  const level = storyLevel(story.content, getStoryType(story.storyType));
  if (level === undefined) return 0;
  return level === 3 && saidOutLoud.has(story.id) ? 4 : level;
}

// The XP a story has earned at a level: every level up to and including it.
export function xpForLevel(level: QuestLevel): number {
  let total = 0;
  for (let l = 1; l <= level; l++) total += LEVEL_XP[l as Exclude<QuestLevel, 0>];
  return total;
}

// The XP a climb from one level to another earns, for the level-up card.
export function xpForClimb(from: QuestLevel, to: QuestLevel): number {
  return Math.max(0, xpForLevel(to) - xpForLevel(from));
}

export type XpLine = { id: string; label: string; count: number; xp: number };

export type XpInput = {
  stories: readonly QuestStory[];
  sessions: readonly QuestSession[];
  // Past interviews: only ones the app has read (analysis saved) count.
  transcripts?: readonly { analysis: unknown }[];
  // Skills at Learned or above (skills.ts), when the caller has the map.
  skillsLearned?: number;
  // Jobs whose boss round was run to the end (boss.ts).
  bossRounds?: number;
};

export type XpSummary = { total: number; lines: XpLine[] };

export function xpSummary({
  stories,
  sessions,
  transcripts = [],
  skillsLearned = 0,
  bossRounds = 0,
}: XpInput): XpSummary {
  const aloud = storiesSaidOutLoud(sessions);
  const reached = [0, 0, 0, 0, 0];
  for (const story of stories) {
    const level = questLevel(story, aloud);
    for (let l = 1; l <= level; l++) reached[l]++;
  }
  const interviews = transcripts.filter((t) => t.analysis != null).length;
  const lines: XpLine[] = [
    { id: "level1", label: "Stories told (Level 1)", count: reached[1], xp: reached[1] * LEVEL_XP[1] },
    { id: "level2", label: "Stories at Level 2", count: reached[2], xp: reached[2] * LEVEL_XP[2] },
    { id: "level3", label: "Stories at Level 3", count: reached[3], xp: reached[3] * LEVEL_XP[3] },
    { id: "level4", label: "Stories said out loud (Level 4)", count: reached[4], xp: reached[4] * LEVEL_XP[4] },
    { id: "skills", label: "Skills learned", count: skillsLearned, xp: skillsLearned * SKILL_LEARNED_XP },
    { id: "boss", label: "Boss rounds run", count: bossRounds, xp: bossRounds * BOSS_XP },
    { id: "interviews", label: "Real interviews logged", count: interviews, xp: interviews * INTERVIEW_XP },
  ];
  return { total: lines.reduce((sum, l) => sum + l.xp, 0), lines };
}

// Ranks. Six stories at Level 4 (3,000 XP) is Interview ready, the app's finish line said out loud.
export const RANKS = [
  { name: "Getting started", from: 0 },
  { name: "Storyteller", from: 500 },
  { name: "Story bank", from: 1500 },
  { name: "Interview ready", from: 3000 },
  { name: "Second nature", from: 4500 },
] as const;

export type Rank = {
  // 1-based, out of RANKS.length.
  number: number;
  name: string;
  from: number;
  // The next rank's start, or null at the top.
  nextAt: number | null;
  nextName: string | null;
  // 0 to 1 through this rank toward the next.
  progress: number;
};

export function rankFor(xp: number): Rank {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].from) i++;
  const here = RANKS[i];
  const next = RANKS[i + 1];
  return {
    number: i + 1,
    name: here.name,
    from: here.from,
    nextAt: next?.from ?? null,
    nextName: next?.name ?? null,
    progress: next ? Math.min(1, Math.max(0, (xp - here.from) / (next.from - here.from))) : 1,
  };
}

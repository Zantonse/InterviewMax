import { isUntouched, type StoryContent } from "@/lib/stories/content";
import { LEVELS, displayLevel, storyLevel, usesLevels, type StoryLevel } from "@/lib/stories/levels";
import { getStoryType } from "@/lib/stories/story-types";

// How the coach's client page groups what the client has made (1:1 coaching, 2026-11-19). Plain
// code over saved rows; no model call.

export type ViewStory = {
  id: string;
  title: string;
  storyType: string | null;
  content: StoryContent;
  updatedAt: string;
};

export type StoryGroup = {
  id: "level-3" | "level-2" | "level-1" | "not-told" | "other";
  title: string;
  note: string;
  stories: (ViewStory & { level?: StoryLevel })[];
};

// Behavioral stories by level, highest first, then the ones not told yet, then About me and tough
// questions (which keep their own grades). Empty groups are left out; untouched stories too.
export function storiesByLevel(stories: ViewStory[]): StoryGroup[] {
  const groups: StoryGroup[] = [
    ...[3, 2, 1].map((level) => ({
      id: `level-${level}` as StoryGroup["id"],
      title: `Level ${level}: ${LEVELS[level - 1].name}`,
      note: LEVELS[level - 1].hears,
      stories: [] as StoryGroup["stories"],
    })),
    {
      id: "not-told",
      title: "Started, not told yet",
      note: "Answers saved, but no story written yet.",
      stories: [],
    },
    {
      id: "other",
      title: "About me and tough questions",
      note: "These keep their own grades, shown on the same 1 to 3 steps.",
      stories: [],
    },
  ];
  const byId = new Map(groups.map((g) => [g.id, g]));
  for (const story of stories) {
    if (isUntouched(story.content)) continue;
    const type = getStoryType(story.storyType);
    if (!usesLevels(type, story.content)) {
      const grade = story.content.grade;
      const level = grade && story.content.draft ? displayLevel(grade, type, story.content) : undefined;
      byId.get("other")!.stories.push({ ...story, level });
      continue;
    }
    const level = storyLevel(story.content, type);
    byId.get(level ? (`level-${level}` as StoryGroup["id"]) : "not-told")!.stories.push({
      ...story,
      level,
    });
  }
  return groups.filter((g) => g.stories.length > 0);
}

export type ViewJob = {
  id: string;
  title: string;
  company: string | null;
  interviewDate: string | null;
  outcome: string | null;
};

// The soonest interview date today or later among jobs still in progress, as YYYY-MM-DD.
export function nextInterview(jobs: ViewJob[], today: string): string | null {
  const dates = jobs
    .filter((j) => !j.outcome && j.interviewDate && j.interviewDate >= today)
    .map((j) => j.interviewDate as string)
    .sort();
  return dates[0] ?? null;
}

// Whole days from `today` to `date` (both YYYY-MM-DD).
export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

// "Today", "Tomorrow", "In 5 days", "Nov 30".
export function whenLabel(date: string, today: string): string {
  const days = daysUntil(date, today);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1 && days <= 14) return `In ${days} days`;
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: days > 300 || days < 0 ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

// "Interview today", "Interview in 6 days", "Interview on Dec 30".
export function interviewLabel(date: string, today: string): string {
  const when = whenLabel(date, today);
  return /^(Today|Tomorrow|In )/.test(when) ? `Interview ${when.toLowerCase()}` : `Interview on ${when}`;
}

// Level counts for the client list: how many behavioral stories sit at each level.
export function levelCounts(stories: ViewStory[]): Record<StoryLevel, number> {
  const counts: Record<StoryLevel, number> = { 1: 0, 2: 0, 3: 0 };
  for (const story of stories) {
    const type = getStoryType(story.storyType);
    if (!usesLevels(type, story.content)) continue;
    const level = storyLevel(story.content, type);
    if (level) counts[level] += 1;
  }
  return counts;
}

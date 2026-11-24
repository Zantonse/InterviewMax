import { storyParts, type StoryType } from "./story-types";

// How long a story takes to say (design review 2026-11-23): the talk track on the story page and
// the times on home use the same count, so a story reads 1:30 everywhere. Plain code, no model.

// At an interview pace of about 150 words a minute.
const WORDS_PER_MINUTE = 150;

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// Rounded to 5 seconds: nobody times an answer closer than that.
export function spokenSeconds(words: number): number {
  return Math.round(((words / WORDS_PER_MINUTE) * 60) / 5) * 5;
}

// 0:00, 1:05, 12:30.
export function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// The whole story's spoken time, from the parts its type tells (as the talk track counts them).
export function storySeconds(
  parts: Record<string, string> | undefined,
  storyType: StoryType | undefined,
): number {
  const words = storyParts(storyType).reduce(
    (sum, p) => sum + countWords(parts?.[p.id]?.trim() ?? ""),
    0,
  );
  return spokenSeconds(words);
}

import { coverageFor } from "@/lib/questions/coverage";
import type { LikelyQuestion } from "@/lib/questions/content";
import type { StoryContent } from "@/lib/stories/content";
import { levelForGrade, storyLevel } from "@/lib/stories/levels";
import { getStoryType, type StoryTypeId } from "@/lib/stories/story-types";

// How ready a target job is, question by question: for each likely question, the level of the
// story that answers it. A picture for the job page and home instead of a list of sentences.

type StoryLike = { id: string; title: string; storyType: string | null; content: StoryContent };

// 0: started, not written yet. 1 to 3: the story levels (levels.ts). Stories that don't use levels
// (About me) map their tier the same way: Not yet 1, Good enough 2, Strong 3.
export type ReadyLevel = 0 | 1 | 2 | 3;

export type QuestionReadiness = {
  question: string;
} & (
  | { kind: "story"; storyId: string; title: string; level: ReadyLevel }
  | { kind: "build"; storyType: StoryTypeId }
);

// A question counts as ready once its story proves something: Level 2 or above.
export const READY_LEVEL: ReadyLevel = 2;

export function readyLevelOf(story: StoryLike): ReadyLevel {
  const content = story.content;
  if (!content.draft) return 0;
  const level = storyLevel(content, getStoryType(story.storyType));
  if (level !== undefined) return level;
  const grade =
    content.grade?.draftWrittenAt === content.draft.writtenAt ? content.grade : undefined;
  return grade ? levelForGrade(grade) : 1;
}

export function questionReadiness(
  questions: LikelyQuestion[] | undefined,
  stories: StoryLike[],
): { rows: QuestionReadiness[]; ready: number; total: number } {
  const byId = new Map(stories.map((s) => [s.id, s]));
  const rows = (questions ?? []).flatMap((q): QuestionReadiness[] => {
    const coverage = coverageFor(q.theme, stories, q.question);
    if (!coverage) return [];
    if (coverage.kind === "build") {
      return [{ question: q.question, kind: "build", storyType: coverage.storyType }];
    }
    const story = byId.get(coverage.storyId);
    return [
      {
        question: q.question,
        kind: "story",
        storyId: coverage.storyId,
        title: coverage.title || "Untitled story",
        level: story ? readyLevelOf(story) : 0,
      },
    ];
  });
  const ready = rows.filter((r) => r.kind === "story" && r.level >= READY_LEVEL).length;
  return { rows, ready, total: rows.length };
}

import { coverageFor } from "@/lib/questions/coverage";
import type { LikelyQuestion } from "@/lib/questions/content";

// A job's page is its folder (tester feedback, Oct 16: everything for one role, like Commerce Bank,
// should live together instead of in separate areas). This gathers what belongs to one job from
// the rest of the app: the stories that answer its likely questions and the past interviews
// linked to it. Plain code, so the page and the tests share it.

type StoryLike = Parameters<typeof coverageFor>[1][number];

export type FolderStory = {
  storyId: string;
  title: string;
  drafted: boolean;
  // The job's likely questions this story answers, most likely first.
  questions: string[];
};

export type JobFolder = {
  stories: FolderStory[];
  // Likely questions a story answers, and how many there are.
  answered: number;
  total: number;
  // Likely questions with no story yet.
  toBuild: number;
};

export function jobFolder(
  questions: LikelyQuestion[] | undefined,
  stories: StoryLike[],
): JobFolder {
  const byStory = new Map<string, FolderStory>();
  let toBuild = 0;
  let answered = 0;
  for (const q of questions ?? []) {
    const coverage = coverageFor(q.theme, stories);
    if (coverage?.kind === "story") {
      const entry = byStory.get(coverage.storyId) ?? {
        storyId: coverage.storyId,
        title: coverage.title || "Untitled story",
        drafted: coverage.drafted,
        questions: [],
      };
      entry.questions.push(q.question);
      answered += 1;
      byStory.set(coverage.storyId, entry);
    } else if (coverage?.kind === "build") {
      toBuild += 1;
    }
  }
  return {
    stories: [...byStory.values()],
    answered,
    total: questions?.length ?? 0,
    toBuild,
  };
}

// How a job reads in the sidebar's list of folders: the company first, since that's how people
// think of a role ("the Commerce Bank one").
export function folderLabel(job: { title: string; company: string | null }): string {
  return job.company ? `${job.company} · ${job.title}` : job.title;
}

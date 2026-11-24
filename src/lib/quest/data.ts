import "server-only";
import { unstable_rethrow } from "next/navigation";
import { listJobs, type TargetJob } from "@/lib/jobs/data";
import { isFinished } from "@/lib/jobs/outcome";
import { questionReadiness } from "@/lib/jobs/readiness";
import { listPracticeSessionsSafely, type PracticeSession } from "@/lib/practice/data";
import { listStories, type StoryRecord } from "@/lib/stories/data";
import { listTranscripts, type Transcript } from "@/lib/transcripts/data";

// What Story Quest is worked out from: the user's stories, practice rounds, open jobs and past
// interviews. Only stories are required; the rest fall back to empty if they can't be read.
export type QuestData = {
  stories: StoryRecord[];
  sessions: PracticeSession[];
  jobs: TargetJob[];
  transcripts: Transcript[];
};

async function safely<T>(what: string, load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch (err) {
    unstable_rethrow(err);
    console.error(`Story Quest: loading ${what} failed`, err);
    return fallback;
  }
}

export async function loadQuestData(): Promise<QuestData> {
  const [stories, sessions, jobs, transcripts] = await Promise.all([
    listStories(),
    listPracticeSessionsSafely(),
    safely("jobs", listJobs, [] as TargetJob[]),
    safely("past interviews", listTranscripts, [] as Transcript[]),
  ]);
  return { stories, sessions, jobs: jobs.filter((j) => !isFinished(j)), transcripts };
}

// Where a story can be practiced: the practice page of an open job whose likely questions it
// answers, or the general practice page.
export function practiceHrefFor(
  storyId: string | undefined,
  jobs: readonly TargetJob[],
  stories: readonly StoryRecord[],
): string {
  if (storyId) {
    for (const job of jobs) {
      const { rows } = questionReadiness(job.likelyQuestions?.questions, [...stories]);
      if (rows.some((r) => r.kind === "story" && r.storyId === storyId)) {
        return `/jobs/${job.id}/practice`;
      }
    }
  }
  return "/practice";
}

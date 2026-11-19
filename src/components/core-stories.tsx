import { headers } from "next/headers";
import { FinishLineBar } from "@/components/finish-line";
import { getJobsPrep, type TargetJob } from "@/lib/jobs/data";
import { nextStoryToBuild } from "@/lib/guide/journey";
import { finishCounts, finishLine } from "@/lib/prep/finish-line";
import { focusJob, todayIn } from "@/lib/prep/plan";
import type { StoryRecord } from "@/lib/stories/data";

// The finish line: how many of the core stories are written, the pace to the interview, and the
// link to today's story (the next one the user's jobs need, or the one in progress). Lives on the
// profile page; home keeps a single next step (design review 2026-11-16, fix 4).
export async function CoreStories({ stories, jobs }: { stories: StoryRecord[]; jobs: TargetJob[] }) {
  const timeZone = (await headers()).get("x-vercel-ip-timezone");
  const today = todayIn(timeZone);
  const line = finishLine(
    finishCounts({ stories, today, timeZone, interviewDate: focusJob(jobs, today)?.interviewDate }),
  );
  const { overview } = await getJobsPrep().catch(() => ({ overview: null }));
  const upNext = overview ? nextStoryToBuild(overview.storyOrder, stories, null) : undefined;
  const next = upNext
    ? {
        href: upNext.storyId ? `/stories/${upNext.storyId}` : `/stories/new/${upNext.storyType}`,
        label: upNext.label,
      }
    : { href: "/stories/new", label: "pick a story" };
  return <FinishLineBar line={line} next={next} />;
}

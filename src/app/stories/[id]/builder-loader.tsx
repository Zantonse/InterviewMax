import { headers } from "next/headers";
import Link from "next/link";
import { DeleteStoryButton } from "@/components/delete-story-button";
import { startStory } from "@/app/stories/new/actions";
import { type NextStory, nextStoryToBuild } from "@/lib/guide/journey";
import { getJobsPrep, listJobs, type TargetJob } from "@/lib/jobs/data";
import { focusJob, jobsToShapeIntroFor, todayIn, whenLabel } from "@/lib/prep/plan";
import { finishCounts } from "@/lib/prep/finish-line";
import { getExecModeSafely } from "@/lib/exec/settings";
import { getUserFieldSafely } from "@/lib/field/data";
import { checklistRole, numbersForStory } from "@/lib/numbers/checklist";
import { getNumbersChecklistSafely } from "@/lib/numbers/data";
import type { StoryContent } from "@/lib/stories/content";
import { listStories, type StoryRecord } from "@/lib/stories/data";
import { REQUIRED_STORY_TYPE_ID, getStoryType } from "@/lib/stories/story-types";
import { loadBuilderTargets } from "@/lib/stories/targets-data";
import { SOURCE_LABELS } from "@/lib/finder/content";
import { getStoryFinder } from "@/lib/finder/data";
import { NumbersCard } from "./numbers-card";
import { StoryBuilder } from "./story-builder";

// A story to open in the builder. Without an id it's a new one that isn't saved yet: the builder
// creates it with the first answer.
export type BuilderStory = {
  id: string | null;
  storyType: string | null;
  title: string;
  content: StoryContent;
};

export async function BuilderLoader({ story }: { story: BuilderStory }) {
  const intro = story.storyType === REQUIRED_STORY_TYPE_ID;
  // Background: the resume and jobs plan (what to build next), and for "Tell me about yourself" the
  // target jobs. Optional, so a failure to load them never blocks the builder.
  const [prep, jobs, stories, checklist, targets, finder, field, execMode] = await Promise.all([
    getJobsPrep().catch(() => ({ resume: null, overview: null })),
    listJobs().catch(() => [] as TargetJob[]),
    intro ? ([] as StoryRecord[]) : listStories().catch(() => [] as StoryRecord[]),
    getNumbersChecklistSafely(),
    loadBuilderTargets(getStoryType(story.storyType)),
    intro ? null : getStoryFinder().catch(() => null),
    getUserFieldSafely(),
    intro ? false : getExecModeSafely(),
  ]);
  // Story finder moments for this story type become memory joggers on the opening question.
  const moments = (finder?.moments ?? [])
    .filter((m) => m.storyType === story.storyType)
    .slice(0, 3)
    .map((m) => ({ moment: m.moment, quote: m.quote, sourceLabel: SOURCE_LABELS[m.source] }));
  const resume = Boolean(prep.resume);
  const timeZone = (await headers()).get("x-vercel-ip-timezone");
  const today = todayIn(timeZone);
  // The finish line for the user's other stories; the builder adds this one once it's written.
  const finishBase = intro
    ? undefined
    : finishCounts({
        stories,
        today,
        timeZone,
        interviewDate: focusJob(jobs, today)?.interviewDate,
        exceptId: story.id,
      });
  return (
    <StoryBuilder
      storyId={story.id}
      newStory={
        story.id || !story.storyType
          ? undefined
          : { storyType: story.storyType, asked: story.content.asked }
      }
      storyTypeId={story.storyType}
      initialTitle={story.title}
      initialContent={story.content}
      hasResume={resume}
      moments={moments}
      field={field.id}
      execMode={execMode}
      priorWritten={finishBase?.written ?? 0}
      finishBase={finishBase}
      recruiterScreen={!intro && jobs.some((j) => !j.outcome && j.nextStage === "recruiter")}
      targets={targets}
      uses={intro && <TailorRows jobs={jobs} content={story.content} today={today} />}
      nextUp={
        !intro && (
          <NextUp
            hasPlan={Boolean(prep.overview)}
            hasJobs={jobs.some((j) => !j.outcome)}
            next={
              prep.overview
                ? nextStoryToBuild(prep.overview.storyOrder, stories, story.storyType)
                : undefined
            }
          />
        )
      }
      menu={story.id ? <DeleteStoryButton storyId={story.id} title={story.title} /> : undefined}
      beside={
        <NumbersCard
          role={checklist && checklistRole(checklist)}
          numbers={numbersForStory(checklist, story.storyType)}
        />
      }
    />
  );
}

// "Tell me about yourself" is built per target job, company first; each job's version lives on its
// job page. One row each under "Use this story": the jobs still waiting for theirs come first,
// nearest interview first, because the general version can only end on a general "why this next
// role".
function TailorRows({
  jobs,
  content,
  today,
}: {
  jobs: TargetJob[];
  content: StoryContent;
  today: string;
}) {
  const written = (id: string) => Boolean(content.tailored?.[id]?.draft);
  const waiting = jobsToShapeIntroFor(jobs, written, today).slice(0, 4);
  const done = jobs.filter((j) => !j.outcome && written(j.id)).slice(0, 4);
  if (waiting.length === 0 && done.length === 0) {
    return (
      <UseRow
        title="Make it company-first"
        what="Add a target job, then say in a line why you want it. The answer is rebuilt around what that company most needs to hear."
        href="/jobs/new"
        action="Add a job"
      />
    );
  }
  return (
    <>
      {waiting.map(({ job, days }, i) => {
        const company = job.company || job.title;
        return (
          <UseRow
            key={job.id}
            title={`Tailor it for ${company}`}
            what={`${days !== null ? `Interview ${whenLabel(days)}. ` : ""}Say in a line why you want ${company}, and the answer is rebuilt around what they most need to hear.`}
            href={`/jobs/${job.id}#about-me`}
            action="Tailor"
            testId={i === 0 ? "tailor-next" : undefined}
          />
        );
      })}
      {done.map((job) => (
        <UseRow
          key={job.id}
          title={`For ${job.company || job.title}`}
          what="Written for this job. It lives on the job page."
          href={`/jobs/${job.id}#about-me`}
          action="Open"
        />
      ))}
    </>
  );
}

// A row of "Use this story" (see UseThisStory in story-builder.tsx), drawn here on the server.
function UseRow({
  title,
  what,
  href,
  action,
  testId,
}: {
  title: string;
  what: string;
  href: string;
  action: string;
  testId?: string;
}) {
  return (
    <li className="border-b border-ink-100 last:border-b-0" data-testid="tailor-links">
      <div className="grid grid-cols-1 gap-x-8 gap-y-1 py-4 sm:grid-cols-[13rem_minmax(0,1fr)_auto] sm:items-baseline">
        <p className="font-medium text-slate-900">{title}</p>
        <p className="text-sm text-slate-600">{what}</p>
        <Link
          href={href}
          className="link justify-self-start text-sm sm:justify-self-end"
          data-testid={testId}
        >
          {action}
        </Link>
      </div>
    </li>
  );
}

// Once a story is written: the next one the user's jobs need, so they never have to work out where
// to go. Without a jobs plan, the step that makes one: reading their jobs if they have some (the
// design review found everyone with jobs but no plan told to add a job, 2026-11-23), or adding one.
function NextUp({
  hasPlan,
  hasJobs,
  next,
}: {
  hasPlan: boolean;
  hasJobs: boolean;
  next: NextStory | undefined;
}) {
  return (
    <section className="border-t border-ink-100 pt-8" data-testid="next-up">
      <h2 className="text-lg font-semibold text-slate-900">Next</h2>
      {next ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <p className="min-w-0">
            <span className="block font-medium text-slate-900">{next.label}</span>
            {next.why && <span className="mt-0.5 block text-sm text-slate-600">{next.why}</span>}
          </p>
          {next.storyId ? (
            <Link href={`/stories/${next.storyId}`} className="btn-secondary shrink-0">
              Continue it
            </Link>
          ) : (
            <form action={startStory}>
              <button
                type="submit"
                name="storyType"
                value={next.storyType}
                className="btn-secondary shrink-0"
              >
                Build it next
              </button>
            </form>
          )}
        </div>
      ) : hasPlan ? (
        <p className="mt-2 text-[0.9375rem] text-slate-700">
          That&apos;s every story your jobs need written. Go over your{" "}
          <Link href="/jobs" className="link">
            likely questions
          </Link>{" "}
          and practise each answer out loud.
        </p>
      ) : hasJobs ? (
        <p className="mt-2 text-[0.9375rem] text-slate-700">
          <Link href="/jobs" className="link">
            Read your jobs
          </Link>{" "}
          to see which story each one needs next.
        </p>
      ) : (
        <p className="mt-2 text-[0.9375rem] text-slate-700">
          <Link href="/jobs/new" className="link">
            Add a target job
          </Link>{" "}
          to see which story to build next.
        </p>
      )}
    </section>
  );
}

export function BuilderSkeleton() {
  return (
    <div className="mt-1 animate-pulse" aria-hidden="true">
      <div className="h-4 w-48 rounded bg-ink-50" />
      <div className="mt-7 h-10 w-2/3 max-w-xl rounded bg-ink-50" />
      <div className="mt-4 h-4 w-80 rounded bg-ink-50" />
      <div className="mt-12 grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="h-72 rounded-[10px] bg-ink-50" />
        <div className="h-56 rounded-[10px] bg-ink-50" />
      </div>
    </div>
  );
}

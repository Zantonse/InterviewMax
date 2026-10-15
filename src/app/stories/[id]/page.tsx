import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { DeleteStoryButton } from "@/components/delete-story-button";
import { startStory } from "@/app/stories/new/actions";
import { type NextStory, nextStoryToBuild } from "@/lib/guide/journey";
import { getJobsPrep, listJobs, type TargetJob } from "@/lib/jobs/data";
import { checklistRole, numbersForStory } from "@/lib/numbers/checklist";
import { getNumbersChecklistSafely } from "@/lib/numbers/data";
import type { StoryContent } from "@/lib/stories/content";
import { getStory, listStories, type StoryRecord } from "@/lib/stories/data";
import { REQUIRED_STORY_TYPE_ID, getStoryType } from "@/lib/stories/story-types";
import { loadBuilderTargets } from "@/lib/stories/targets-data";
import { isToughType } from "@/lib/tough/questions";
import { NumbersCard } from "./numbers-card";
import { StoryBuilder } from "./story-builder";

export const metadata: Metadata = { title: "Story builder · InterviewMax" };

// The builder's model calls run as Server Actions on this page; writing a story can take a while.
export const maxDuration = 120;

export default function StoryPage({ params }: PageProps<"/stories/[id]">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 sm:py-6">
        <Link href="/" className="text-sm font-medium text-ink-800 hover:underline">
          ← Back to your prep
        </Link>
        <Suspense fallback={<BuilderSkeleton />}>
          <StoryLoader params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function StoryLoader({ params }: { params: PageProps<"/stories/[id]">["params"] }) {
  const { id } = await params;
  const story = await getStory(id);
  if (!story) notFound();
  // Tough-question answers have their own coach page.
  if (isToughType(story.storyType)) redirect(`/tough-questions/${story.id}`);
  const intro = story.storyType === REQUIRED_STORY_TYPE_ID;
  // Background: the resume and jobs plan (what to build next), and for "Tell me about yourself" the
  // target jobs. Optional, so a failure to load them never blocks the builder.
  const [prep, jobs, stories, checklist, targets] = await Promise.all([
    getJobsPrep().catch(() => ({ resume: null, overview: null })),
    intro ? listJobs().catch(() => [] as TargetJob[]) : ([] as TargetJob[]),
    intro ? ([] as StoryRecord[]) : listStories().catch(() => [] as StoryRecord[]),
    getNumbersChecklistSafely(),
    loadBuilderTargets(getStoryType(story.storyType)),
  ]);
  const resume = Boolean(prep.resume);
  return (
    <StoryBuilder
      storyId={story.id}
      storyTypeId={story.storyType}
      initialTitle={story.title}
      initialContent={story.content}
      hasResume={resume}
      targets={targets}
      afterStory={intro && <TailorLinks jobs={jobs} content={story.content} />}
      nextUp={
        !intro && (
          <NextUp
            hasPlan={Boolean(prep.overview)}
            next={
              prep.overview
                ? nextStoryToBuild(prep.overview.storyOrder, stories, story.storyType)
                : undefined
            }
          />
        )
      }
      menu={<DeleteStoryButton storyId={story.id} title={story.title} />}
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
// job page.
function TailorLinks({ jobs, content }: { jobs: TargetJob[]; content: StoryContent }) {
  return (
    <section
      className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6"
      data-testid="tailor-links"
    >
      <h2 className="text-sm font-bold uppercase tracking-wide text-ink-800">
        Next: make it company-first for each job
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        This is your general answer. For each job, I&apos;ll rebuild it around what that company
        most needs to hear.
      </p>
      {jobs.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">
          <Link href="/jobs" className="font-semibold text-ink-800 underline">
            Add a target job
          </Link>{" "}
          to get started.
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link
                href={`/jobs/${job.id}#about-me`}
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-ink-800 ring-1 ring-ink-800/20 hover:bg-ink-50"
              >
                {job.company || job.title}
                {content.tailored?.[job.id]?.draft && (
                  <span className="text-xs text-slate-500">written</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Once a story is written: the next one the user's jobs need, so they never have to work out where
// to go. Without a jobs plan, the step that makes one.
function NextUp({ hasPlan, next }: { hasPlan: boolean; next: NextStory | undefined }) {
  return (
    <section
      className="rounded-3xl bg-ink-50 p-5 ring-1 ring-ink-800/10 sm:p-6"
      data-testid="next-up"
    >
      <h2 className="text-sm font-bold uppercase tracking-wide text-ink-800">What&apos;s next</h2>
      {next ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 text-slate-700">
            <span className="block font-semibold text-slate-900">{next.label}</span>
            {next.why && <span className="block text-sm text-slate-600">{next.why}</span>}
          </p>
          {next.storyId ? (
            <Link href={`/stories/${next.storyId}`} className={NEXT_BUTTON}>
              Continue it
            </Link>
          ) : (
            <form action={startStory}>
              <button type="submit" name="storyType" value={next.storyType} className={NEXT_BUTTON}>
                Build it next
              </button>
            </form>
          )}
        </div>
      ) : hasPlan ? (
        <p className="mt-2 text-slate-700">
          That&apos;s every story your jobs need written. Go over your{" "}
          <Link href="/jobs" className="font-semibold text-ink-800 underline">
            likely questions
          </Link>{" "}
          and practise each answer out loud.
        </p>
      ) : (
        <p className="mt-2 text-slate-700">
          <Link href="/jobs/new" className="font-semibold text-ink-800 underline">
            Add a target job
          </Link>{" "}
          and I&apos;ll tell you which story to build next.
        </p>
      )}
    </section>
  );
}

const NEXT_BUTTON =
  "inline-block shrink-0 rounded-xl bg-accent-400 px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-accent-300";

function BuilderSkeleton() {
  return (
    <div className="mt-14 grid animate-pulse grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="h-96 rounded-3xl bg-white/80 ring-1 ring-black/5" />
      <div className="h-64 rounded-3xl bg-white/80 ring-1 ring-black/5" />
    </div>
  );
}

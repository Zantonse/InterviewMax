import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { CoverageGrid } from "@/components/coverage-grid";
import { PrepPath } from "@/components/prep-path";
import { QuestionList } from "@/components/question-list";
import { levelLabel } from "@/lib/jobs/content";
import { listJobs, type TargetJob } from "@/lib/jobs/data";
import { builderStage } from "@/lib/stories/content";
import { listStories, type StoryRecord } from "@/lib/stories/data";
import { getStoryType } from "@/lib/stories/story-types";
import { gapLabel, summarizeTranscripts } from "@/lib/transcripts/content";
import { listTranscripts, type Transcript } from "@/lib/transcripts/data";

// Adding the first job from the home page reads the posting and predicts its questions, which are
// model calls.
export const maxDuration = 120;

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Your interview prep
          </h1>
          {/* On wide screens the sidebar has this button. */}
          <Link
            href="/stories/new"
            className="rounded-xl bg-navy-800 px-4 py-2.5 font-semibold text-white transition hover:bg-navy-900 lg:hidden"
          >
            Build a story
          </Link>
        </div>

        <Suspense fallback={<div className="mt-5 h-16 animate-pulse rounded-2xl bg-white/80" />}>
          <PrepPath />
        </Suspense>

        <Suspense fallback={null}>
          <Dashboard />
        </Suspense>
      </main>
    </div>
  );
}

// The story bank, and beside it the target jobs and their likely questions once there is a job.
// Before the first job the prep path above asks for one, so the side column stays out of the way.
async function Dashboard() {
  let jobs: TargetJob[] | null;
  try {
    jobs = await listJobs();
  } catch (err) {
    unstable_rethrow(err);
    console.error("Home: loading target jobs failed", err);
    jobs = null;
  }
  const bank = (
    <Card className="bg-navy-800 text-white" title="Story bank">
      <Suspense fallback={<p className="text-5xl font-extrabold opacity-50">…</p>}>
        <StoryBank jobs={jobs ?? []} />
      </Suspense>
    </Card>
  );
  if (jobs?.length === 0) return <div className="mt-4">{bank}</div>;
  return (
    <div className="mt-4 grid grid-cols-1 items-start gap-4 md:grid-cols-3">
      <div className="md:col-span-2">{bank}</div>
      <div className="space-y-4">
        {jobs ? (
          <>
            <LikelyQuestions jobs={jobs} />
            <TargetJobs jobs={jobs} />
          </>
        ) : (
          <Card title="Target jobs">
            <EmptyLine>Your target jobs couldn&apos;t be loaded right now.</EmptyLine>
          </Card>
        )}
        <Suspense fallback={null}>
          <PastInterviews />
        </Suspense>
      </div>
    </div>
  );
}

async function StoryBank({ jobs }: { jobs: TargetJob[] }) {
  let stories: StoryRecord[];
  try {
    stories = await listStories();
  } catch (err) {
    // A signed-out redirect must still go through.
    unstable_rethrow(err);
    // Don't take the whole home page down if the database can't be read.
    console.error("Home: loading stories failed", err);
    return (
      <p className="max-w-md text-navy-50" role="alert" data-testid="story-bank-error">
        Your stories couldn&apos;t be loaded right now. Try again in a minute.
      </p>
    );
  }
  return (
    <>
      <p className="-mt-1 flex items-baseline gap-2">
        <span className="text-4xl font-extrabold" data-testid="story-count">
          {stories.length}
        </span>
        <span className="text-navy-100">{stories.length === 1 ? "story" : "stories"}</span>
      </p>
      <CoverageGrid stories={stories} jobs={jobs} />
      {stories.length > 0 && (
        <ul className="mt-6 divide-y divide-white/15 rounded-2xl bg-white/10">
          {stories.map((story) => {
            const drafted =
              builderStage(story.content, getStoryType(story.storyType)) === "drafted";
            return (
              <li key={story.id}>
                <Link
                  href={`/stories/${story.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-white/10"
                >
                  <span className="min-w-0 truncate font-semibold">{story.title}</span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      drafted ? "bg-white text-navy-900" : "bg-navy-900/60 text-navy-50"
                    }`}
                  >
                    {drafted ? "Draft written" : "In progress"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function TargetJobs({ jobs }: { jobs: TargetJob[] }) {
  return (
    <Card title="Target jobs">
      <ul className="space-y-2" data-testid="home-jobs">
        {jobs.map((job) => (
          <li key={job.id}>
            <Link href={`/jobs/${job.id}`} className="block hover:text-navy-800">
              <span className="block truncate font-semibold">{job.title}</span>
              <span className="block truncate text-sm text-slate-500">
                {[job.company, levelLabel(job.level)].filter(Boolean).join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

async function LikelyQuestions({ jobs }: { jobs: TargetJob[] }) {
  const job = jobs.find((j) => j.likelyQuestions);
  // Until one job has its questions, the prep path's next step is predicting them.
  if (!job?.likelyQuestions) return null;
  let stories: StoryRecord[];
  try {
    stories = await listStories();
  } catch (err) {
    unstable_rethrow(err);
    console.error("Home: loading stories for likely questions failed", err);
    stories = [];
  }
  return (
    <Card title="Likely questions">
      <p className="mb-3 text-sm text-slate-500">For {job.title}</p>
      <QuestionList questions={job.likelyQuestions.questions} stories={stories} limit={3} compact />
      <Link
        href={`/jobs/${job.id}`}
        className="mt-4 inline-block text-sm font-semibold text-navy-800 hover:underline"
      >
        All {job.likelyQuestions.questions.length} questions →
      </Link>
    </Card>
  );
}

// Only shown once past interviews point at something to fix; the sidebar links to the page itself.
async function PastInterviews() {
  let transcripts: Transcript[];
  try {
    transcripts = await listTranscripts();
  } catch (err) {
    unstable_rethrow(err);
    console.error("Home: loading transcripts failed", err);
    return null;
  }
  const { recurringGaps } = summarizeTranscripts(transcripts);
  if (recurringGaps.length === 0) return null;
  return (
    <Card title="Past interviews">
      <Link href="/transcripts" className="block text-slate-700 hover:text-navy-800">
        Your answers keep missing{" "}
        {recurringGaps
          .slice(0, 3)
          .map((g) => gapLabel(g.gap).toLowerCase())
          .join(", ")}
        . →
      </Link>
    </Card>
  );
}

function Card({
  title,
  className = "bg-white text-slate-900",
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-3xl p-6 shadow-sm ring-1 ring-black/5 ${className}`}>
      <h2 className="text-sm font-bold uppercase tracking-wide opacity-80">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-slate-500">{children}</p>;
}

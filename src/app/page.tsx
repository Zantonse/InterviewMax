import { headers } from "next/headers";
import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { startStory } from "@/app/stories/new/actions";
import { AppHeader } from "@/components/app-header";
import { CoverageGrid } from "@/components/coverage-grid";
import { PrepPath } from "@/components/prep-path";
import { shouldStartWithAssessment } from "@/lib/assessment/data";
import { listJobs, type TargetJob } from "@/lib/jobs/data";
import { daysUntil, focusJob, todayIn, whenLabel } from "@/lib/prep/plan";
import { getAppMode } from "@/lib/promotion/data";
import type { LikelyQuestion } from "@/lib/questions/content";
import { coverageFor } from "@/lib/questions/coverage";
import { listStories, type StoryRecord } from "@/lib/stories/data";
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
        {/* "Build a story" is in the sidebar (the phone menu on small screens); the plan's Continue is
            the one main button here. */}
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Your interview prep
        </h1>

        <Suspense fallback={<div className="mt-5 h-16 animate-pulse rounded-2xl bg-white/80" />}>
          <NewUserGate>
            <Suspense
              fallback={<div className="mt-5 h-16 animate-pulse rounded-2xl bg-white/80" />}
            >
              <PrepPath />
            </Suspense>
            <Suspense fallback={null}>
              <Dashboard />
            </Suspense>
          </NewUserGate>
        </Suspense>
      </main>
    </div>
  );
}

// A brand-new user starts with the journey check; everyone else gets the home page. In PromotionMax
// home is the promotion page.
async function NewUserGate({ children }: { children: React.ReactNode }) {
  if ((await getAppMode()) === "promotion") redirect("/promotion");
  if (await shouldStartWithAssessment()) redirect("/assessment");
  return <>{children}</>;
}

// The story bank, and beside it the focus job and its likely questions. Before the first job the
// prep path above asks for one, and an empty story bank would only be a wall of work under it, so
// nothing else shows until there's a job or a story.
async function Dashboard() {
  let jobs: TargetJob[] | null;
  let stories: StoryRecord[] | null;
  try {
    jobs = await listJobs();
  } catch (err) {
    unstable_rethrow(err);
    console.error("Home: loading target jobs failed", err);
    jobs = null;
  }
  try {
    stories = await listStories();
  } catch (err) {
    // A signed-out redirect must still go through.
    unstable_rethrow(err);
    // Don't take the whole home page down if the database can't be read.
    console.error("Home: loading stories failed", err);
    stories = null;
  }
  if (jobs?.length === 0 && stories?.length === 0) return null;
  const bank = (
    <Card className="bg-ink-800 text-white" title="Story bank">
      {stories ? (
        <CoverageGrid stories={stories} jobs={jobs ?? []} />
      ) : (
        <p className="max-w-md text-ink-50" role="alert" data-testid="story-bank-error">
          Your stories couldn&apos;t be loaded right now. Try again in a minute.
        </p>
      )}
    </Card>
  );
  if (jobs?.length === 0) return <div className="mt-4">{bank}</div>;
  return (
    <div className="mt-4 grid grid-cols-1 items-start gap-4 md:grid-cols-3">
      <div className="md:col-span-2">{bank}</div>
      <div className="space-y-4">
        {jobs ? (
          <FocusJob jobs={jobs} stories={stories ?? []} />
        ) : (
          <Card title="Your jobs">
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

// The job the plan is working toward, with its top questions and whether a story answers each.
// The other jobs are in the sidebar.
async function FocusJob({ jobs, stories }: { jobs: TargetJob[]; stories: StoryRecord[] }) {
  const today = todayIn((await headers()).get("x-vercel-ip-timezone"));
  const job = focusJob(jobs, today);
  if (!job) return null;
  const days = job.interviewDate ? daysUntil(job.interviewDate, today) : null;
  const name = job.company || job.title;
  const questions = job.likelyQuestions?.questions ?? [];
  return (
    <Card title={days !== null && days >= 0 ? `${name} · interview ${whenLabel(days)}` : name}>
      <div data-testid="focus-job">
        {job.company && <p className="-mt-3 mb-3 truncate text-sm text-slate-500">{job.title}</p>}
        {questions.length > 0 ? (
          <>
            <p className="text-sm font-semibold text-slate-700">Most likely questions</p>
            <ul className="mt-2 space-y-3">
              {questions.slice(0, 3).map((q) => (
                <FocusQuestion key={q.question} question={q} stories={stories} />
              ))}
            </ul>
            <Link
              href={`/jobs/${job.id}`}
              className="mt-4 inline-block text-sm font-semibold text-ink-800 hover:underline"
            >
              All {questions.length} questions for this job →
            </Link>
          </>
        ) : (
          <Link href={`/jobs/${job.id}`} className="text-sm font-semibold text-ink-800 hover:underline">
            Open this job →
          </Link>
        )}
      </div>
    </Card>
  );
}

function FocusQuestion({ question, stories }: { question: LikelyQuestion; stories: StoryRecord[] }) {
  const coverage = coverageFor(question.theme, stories);
  return (
    <li className="text-sm">
      <p className="font-medium text-slate-900">{question.question}</p>
      {coverage?.kind === "story" ? (
        <Link
          href={`/stories/${coverage.storyId}`}
          className="mt-0.5 inline-block text-slate-600 hover:text-ink-800 hover:underline"
        >
          <span aria-hidden className={coverage.drafted ? "text-ink-800" : "text-slate-400"}>
            {coverage.drafted ? "✓ " : "○ "}
          </span>
          {coverage.drafted ? "Answer with" : "In progress"}: {coverage.title}
        </Link>
      ) : coverage?.kind === "build" ? (
        <form action={startStory} className="mt-0.5">
          <input type="hidden" name="asked" value={question.question} />
          <button
            type="submit"
            name="storyType"
            value={coverage.storyType}
            className="text-ink-800 hover:underline"
          >
            No story yet · Build one →
          </button>
        </form>
      ) : null}
    </li>
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
      <Link href="/transcripts" className="block text-slate-700 hover:text-ink-800">
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
      <h2 className="truncate text-lg font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-slate-500">{children}</p>;
}

import { headers } from "next/headers";
import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { startStory } from "@/app/stories/new/actions";
import { ReadinessRing, ReadinessRows } from "@/components/readiness";
import { questionReadiness, READY_LEVEL, type QuestionReadiness } from "@/lib/jobs/readiness";
import { AppHeader } from "@/components/app-header";
import { CoverageGrid } from "@/components/coverage-grid";
import { PrepPath } from "@/components/prep-path";
import { shouldStartWithAssessment } from "@/lib/assessment/data";
import { listJobs, type TargetJob } from "@/lib/jobs/data";
import { daysUntil, focusJob, todayIn } from "@/lib/prep/plan";
import { getAppMode } from "@/lib/promotion/data";
import { RankCard } from "@/components/quest/rank-card";
import { listPracticeSessionsSafely } from "@/lib/practice/data";
import { questState } from "@/lib/quest/state";
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

// Under the plan bar: the focus job as the hero (how many likely questions have a solid story,
// and the next one to work on), then the story bank. Before the first job the prep path above asks
// for one, and an empty story bank would only be a wall of work under it, so nothing else shows
// until there's a job or a story. The finish line and story skills live on /profile, so home has
// one main button (the plan's Continue) and few counters (design review 2026-11-16, fix 4).
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
  return (
    <div className="mt-4 space-y-4">
      {stories && (
        <Suspense fallback={null}>
          <QuestCard stories={stories} />
        </Suspense>
      )}
      {jobs ? (
        <FocusJob jobs={jobs} stories={stories ?? []} />
      ) : (
        <Card title="Your jobs">
          <EmptyLine>Your target jobs couldn&apos;t be loaded right now.</EmptyLine>
        </Card>
      )}
      <Card className="bg-ink-800 text-white" title="Story bank">
        {stories ? (
          <CoverageGrid stories={stories} jobs={jobs ?? []} />
        ) : (
          <p className="max-w-md text-ink-50" role="alert" data-testid="story-bank-error">
            Your stories couldn&apos;t be loaded right now. Try again in a minute.
          </p>
        )}
      </Card>
      <Suspense fallback={null}>
        <PastInterviews />
      </Suspense>
    </div>
  );
}

// The job the plan is working toward: a ring with the days to go, how many likely questions have a
// story at Level 2 or above, the next question to work on, and its top questions. The other jobs
// are in the sidebar.
async function FocusJob({ jobs, stories }: { jobs: TargetJob[]; stories: StoryRecord[] }) {
  const today = todayIn((await headers()).get("x-vercel-ip-timezone"));
  const job = focusJob(jobs, today);
  if (!job) return null;
  const days = job.interviewDate ? daysUntil(job.interviewDate, today) : null;
  const upcoming = days !== null && days >= 0 ? days : null;
  const name = job.company || job.title;
  const questions = job.likelyQuestions?.questions ?? [];
  const readiness = questionReadiness(questions, stories);
  const next =
    readiness.rows.find((r) => r.kind === "build") ??
    readiness.rows.find((r) => r.kind === "story" && r.level < READY_LEVEL);
  return (
    <section
      className="animate-enter rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6"
      data-testid="focus-job"
      aria-label={`Your ${name} interview`}
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-8">
        <div className="flex min-w-0 items-center gap-4 md:w-72 md:shrink-0 md:items-start">
          {readiness.total > 0 && (
            <ReadinessRing ready={readiness.ready} total={readiness.total} days={upcoming} />
          )}
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900">
              <Link href={`/jobs/${job.id}`} className="hover:text-ink-800 hover:underline">
                {name}
              </Link>
            </h2>
            {job.company && <p className="truncate text-sm text-slate-600">{job.title}</p>}
          </div>
        </div>
        {readiness.total > 0 ? (
          <div className="min-w-0 flex-1">
            <p className="text-slate-700" data-testid="focus-ready">
              <strong className="text-slate-900">
                {readiness.ready} of {readiness.total} likely questions
              </strong>{" "}
              have a story at Level {READY_LEVEL} or above.
            </p>
            {next && (
              <div className="mt-3 rounded-2xl bg-ink-50 px-4 py-3" data-testid="focus-next">
                <p className="text-sm text-slate-600">Next to work on</p>
                <p className="mt-0.5 font-semibold text-slate-900">{next.question}</p>
                <NextQuestion row={next} />
              </div>
            )}
            <ReadinessRows rows={readiness.rows.filter((r) => r !== next).slice(0, 3)} />
            <Link
              href={`/jobs/${job.id}`}
              className="mt-2 inline-block text-sm font-semibold text-ink-800 hover:underline"
            >
              All {questions.length} questions for this job →
            </Link>
          </div>
        ) : (
          <Link href={`/jobs/${job.id}`} className="text-sm font-semibold text-ink-800 hover:underline">
            Open this job →
          </Link>
        )}
      </div>
    </section>
  );
}

// The next question's action, as an outline button: the plan's Continue above is the page's one
// periwinkle button.
function NextQuestion({ row }: { row: QuestionReadiness }) {
  const className =
    "mt-2 inline-flex min-h-9 items-center rounded-xl bg-white px-3.5 py-1.5 text-sm font-semibold text-ink-800 ring-1 ring-ink-800/30 hover:bg-ink-50";
  if (row.kind === "build") {
    return (
      <form action={startStory}>
        <input type="hidden" name="asked" value={row.question} />
        <button type="submit" name="storyType" value={row.storyType} className={className}>
          Build a story for it
        </button>
      </form>
    );
  }
  return (
    <Link href={`/stories/${row.storyId}`} className={className}>
      {row.level === 0 ? "Finish its story" : "Take its story to Level 2"}
    </Link>
  );
}

// Story Quest's rank and XP in one line, linking to the section. Phones reach /quest from here (the
// bottom tab bar is full); the sidebar links to it too.
async function QuestCard({ stories }: { stories: StoryRecord[] }) {
  const [sessions, transcripts] = await Promise.all([
    listPracticeSessionsSafely(),
    listTranscripts().catch((err) => {
      unstable_rethrow(err);
      return [] as Transcript[];
    }),
  ]);
  const { xp } = questState({ stories, sessions, transcripts });
  return <RankCard xp={xp} compact />;
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
  return <p className="text-slate-600">{children}</p>;
}

import { headers } from "next/headers";
import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { PrepPath } from "@/components/prep-path";
import { nextFirst, QuestionTable } from "@/components/question-table";
import { SectionHead } from "@/components/section-head";
import { StoryBank } from "@/components/story-bank";
import { shouldStartWithAssessment } from "@/lib/assessment/data";
import { roundLabel } from "@/lib/bank/content";
import { listJobs, type TargetJob } from "@/lib/jobs/data";
import { questionReadiness, READY_LEVEL } from "@/lib/jobs/readiness";
import { dateLabel, daysUntil, focusJob, interviewHeadline, todayIn } from "@/lib/prep/plan";
import { getAppMode } from "@/lib/promotion/data";
import { listPracticeSessionsSafely } from "@/lib/practice/data";
import { rankFor } from "@/lib/quest/xp";
import { questState } from "@/lib/quest/state";
import { listStories, type StoryRecord } from "@/lib/stories/data";
import { gapLabel, summarizeTranscripts } from "@/lib/transcripts/content";
import { listTranscripts, type Transcript } from "@/lib/transcripts/data";

// Adding the first job from the home page reads the posting and predicts its questions, which are
// model calls.
export const maxDuration = 120;

// How many likely questions home lists; the job page has the rest.
const QUESTIONS_SHOWN = 6;

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="page">
        <Suspense fallback={<HomeSkeleton />}>
          <NewUserGate>
            <Home />
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

// Home as today's plan (design review 2026-11-23, fix 6): the date and the interview it's all for,
// today's one step, the likely questions with the story that answers each, then the story bank as
// cue cards and past interviews in a line. Before the first job, the step asks for one, and an empty
// bank would only be a wall of work under it, so nothing else shows until there's a job or a story.
async function Home() {
  const today = todayIn((await headers()).get("x-vercel-ip-timezone"));
  const [jobs, stories] = await Promise.all([loadJobs(), loadStories()]);
  const job = jobs ? focusJob(jobs, today) : null;
  const empty = jobs?.length === 0 && stories?.length === 0;
  return (
    <>
      <Header today={today} job={job} />
      <Suspense fallback={<div className="mt-8 h-32 animate-pulse rounded-[10px] bg-ink-50" />}>
        <PrepPath />
      </Suspense>
      {jobs === null && (
        <p className="mt-8 text-slate-600" role="alert">
          Your target jobs couldn&apos;t be loaded right now.
        </p>
      )}
      {job && <LikelyQuestions job={job} stories={stories ?? []} />}
      {!empty &&
        (stories ? (
          <StoryBank stories={stories} jobs={jobs ?? []} />
        ) : (
          <p className="mt-12 text-slate-600" role="alert" data-testid="story-bank-error">
            Your stories couldn&apos;t be loaded right now. Try again in a minute.
          </p>
        ))}
      {stories && !empty && (
        <Suspense fallback={null}>
          <QuestLine stories={stories} />
        </Suspense>
      )}
      {!empty && (
        <Suspense fallback={null}>
          <PastInterviews />
        </Suspense>
      )}
    </>
  );
}

async function loadJobs(): Promise<TargetJob[] | null> {
  try {
    return await listJobs();
  } catch (err) {
    // A signed-out redirect must still go through.
    unstable_rethrow(err);
    console.error("Home: loading target jobs failed", err);
    return null;
  }
}

async function loadStories(): Promise<StoryRecord[] | null> {
  try {
    return await listStories();
  } catch (err) {
    unstable_rethrow(err);
    // Don't take the whole home page down if the database can't be read.
    console.error("Home: loading stories failed", err);
    return null;
  }
}

// "Monday, November 23", then "Northwind Health interview in 6 days" with the day, the round and the
// role under it.
function Header({ today, job }: { today: string; job: TargetJob | null }) {
  const days = job?.interviewDate ? daysUntil(job.interviewDate, today) : null;
  const upcoming = days !== null && days >= 0 ? days : null;
  const name = job ? job.company || job.title : null;
  const round = roundLabel(job?.nextStage);
  return (
    <header>
      <p className="text-sm text-slate-600" data-testid="today">
        {dateLabel(today)}
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
        {name
          ? upcoming !== null
            ? interviewHeadline(name, upcoming)
            : `${name} interview prep`
          : "Prep"}
      </h1>
      {job && (
        <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-slate-600" data-testid="focus-meta">
          {upcoming !== null && job.interviewDate ? (
            <span>{dateLabel(job.interviewDate, "short")}</span>
          ) : (
            <Link
              href={`/jobs/${job.id}#interview-date`}
              className="link"
              data-testid="set-interview-date"
            >
              Add the interview date
            </Link>
          )}
          {round && <span>{/round|screen|loop/i.test(round) ? round : `${round} round`}</span>}
          {job.company && (
            <Link href={`/jobs/${job.id}`} className="hover:text-slate-900 hover:underline">
              {job.title}
            </Link>
          )}
        </p>
      )}
    </header>
  );
}

// The focus job's likely questions as a table (see components/question-table.tsx), the next one to
// work on first; the job page has the rest.
function LikelyQuestions({ job, stories }: { job: TargetJob; stories: StoryRecord[] }) {
  const readiness = questionReadiness(job.likelyQuestions?.questions, stories);
  if (readiness.total === 0) {
    return (
      <section className="mt-12" aria-labelledby="likely-heading" data-testid="focus-job">
        <SectionHead id="likely-heading" title="Likely questions" />
        <p className="mt-4 text-slate-600">
          Not predicted yet.{" "}
          <Link href={`/jobs/${job.id}#questions`} className="link">
            Predict the questions for {job.company || job.title}
          </Link>
        </p>
      </section>
    );
  }
  return (
    <section className="mt-12" aria-labelledby="likely-heading" data-testid="focus-job">
      <SectionHead
        id="likely-heading"
        title="Likely questions"
        note={
          <span data-testid="focus-ready">
            {readiness.ready} of {readiness.total} have a story at Level {READY_LEVEL} or above
          </span>
        }
        action={
          <Link href={`/jobs/${job.id}#questions`} className="link">
            All {readiness.total}
          </Link>
        }
      />
      <QuestionTable
        rows={nextFirst(readiness.rows).slice(0, QUESTIONS_SHOWN)}
        stories={stories}
        testId="focus-questions"
      />
    </section>
  );
}

// Story Quest in one line near the end: rank and XP, linking to the section. On phones this is the
// way in (the bottom tab bar is full); the sidebar links to it too.
async function QuestLine({ stories }: { stories: StoryRecord[] }) {
  const [sessions, transcripts] = await Promise.all([
    listPracticeSessionsSafely(),
    listTranscripts().catch((err) => {
      unstable_rethrow(err);
      return [] as Transcript[];
    }),
  ]);
  const { xp } = questState({ stories, sessions, transcripts });
  const rank = rankFor(xp.total);
  return (
    <p className="mt-12 border-t border-ink-200 pt-5 text-slate-600" data-testid="quest-home-card">
      <span className="mr-3 font-semibold text-slate-900">Story Quest</span>
      {rank.name}, <span className="tabular-nums">{xp.total.toLocaleString("en-US")} XP</span>
      {rank.nextAt !== null && (
        <>
          {" "}
          · {(rank.nextAt - xp.total).toLocaleString("en-US")} to {rank.nextName}
        </>
      )}
      .{" "}
      <Link href="/quest" className="link">
        Open
      </Link>
    </p>
  );
}

// One line at the end, once past interviews point at something to fix.
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
    <p
      className="mt-12 border-t border-ink-200 pt-5 text-slate-600"
      data-testid="home-past-interviews"
    >
      <span className="mr-3 font-semibold text-slate-900">Past interviews</span>
      Your answers keep missing{" "}
      {recurringGaps
        .slice(0, 3)
        .map((g) => gapLabel(g.gap).toLowerCase())
        .join(", ")}
      .{" "}
      <Link href="/transcripts" className="link">
        See why
      </Link>
    </p>
  );
}

function HomeSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-4 w-40 animate-pulse rounded bg-ink-50" />
      <div className="mt-3 h-8 w-96 max-w-full animate-pulse rounded bg-ink-50" />
      <div className="mt-8 h-32 animate-pulse rounded-[10px] bg-ink-50" />
    </div>
  );
}

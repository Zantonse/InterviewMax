import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { StoryPlan } from "@/components/story-plan";
import { roundLabel } from "@/lib/bank/content";
import { levelLabel, overviewBasis } from "@/lib/jobs/content";
import { getJobsPrep, listJobs, type TargetJob } from "@/lib/jobs/data";
import { isFinished, outcomeSummary } from "@/lib/jobs/outcome";
import { questionReadiness } from "@/lib/jobs/readiness";
import { dateLabel } from "@/lib/prep/plan";
import { listStories, type StoryRecord } from "@/lib/stories/data";
import { removeResume } from "./actions";
import { AddJobForm, PendingButton, RereadButton, ResumeForm } from "./forms";

export const metadata: Metadata = { title: "Target jobs · InterviewMax" };

// Saving a resume reads every job again, which is a model call.
export const maxDuration = 120;

export default function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ finished?: string }>;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="page">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Target jobs</h1>
          <Link href="/jobs/new" className="btn-secondary" data-testid="add-job-link">
            Add a target job
          </Link>
        </div>
        <p className="mt-2 max-w-2xl text-slate-600">
          Paste a posting or a link to see the questions it&apos;s likely to bring and which stories
          to build first.
        </p>
        <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-[10px] bg-ink-50" />}>
          <JobsContent searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function JobsContent({ searchParams }: { searchParams: Promise<{ finished?: string }> }) {
  const [jobs, { resume, overview }, stories, params] = await Promise.all([
    listJobs(),
    getJobsPrep(),
    listStories(),
    searchParams,
  ]);
  // Finished jobs (an outcome is set) leave the main list for a folded section below it, so the
  // list shows only the jobs still in play. The sidebar's "Finished jobs" link opens it.
  const active = jobs.filter((j) => !isFinished(j));
  const finished = jobs.filter(isFinished);

  if (jobs.length === 0) {
    return (
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Add your first target job" className="lg:col-span-2">
          <AddJobForm />
        </Card>
        <ResumeCard resume={resume} />
      </div>
    );
  }

  const stale =
    !overview ||
    overview.basis !==
      overviewBasis(
        jobs.map((j) => j.id),
        resume,
      );

  // The jobs as a table (design review 2026-11-23, fix 9): one row each with its level, the
  // interview and how many of its likely questions have a story. What the jobs need comes after,
  // with the resume beside it.
  return (
    <>
      {stale && (
        <div
          className="mt-8 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 rounded-[10px] bg-ink-50 px-5 py-4"
          data-testid="jobs-stale"
        >
          <p className="text-slate-700">
            <span className="font-semibold text-slate-900">Not read yet.</span> Your jobs or resume
            changed since they were last read, so what&apos;s below may be out of date.
          </p>
          <RereadButton />
        </div>
      )}

      {active.length > 0 ? (
        <JobTable jobs={active} overview={overview} stories={stories} testId="job-list" />
      ) : (
        <p className="mt-8 border-t border-ink-200 pt-5 text-slate-700">
          Every job here has finished. Add the next one you&apos;re going for, and it&apos;s read
          with the rest.{" "}
          <Link href="/jobs/new" className="link">
            Add a target job
          </Link>
        </p>
      )}

      {finished.length > 0 && (
        <details
          id="finished-jobs"
          open={params.finished === "1"}
          className="group mt-8"
          data-testid="finished-jobs"
        >
          <summary className="cursor-pointer list-none text-sm [&::-webkit-details-marker]:hidden">
            <span
              aria-hidden="true"
              className="mr-2 inline-block text-slate-500 transition group-open:rotate-90"
            >
              ›
            </span>
            <span className="font-semibold text-slate-900">Finished jobs ({finished.length})</span>
            <span className="ml-3 text-slate-600">
              Kept for their interviews and stories. They don&apos;t count toward your job limit.
            </span>
          </summary>
          <JobTable
            jobs={finished}
            overview={overview}
            stories={stories}
            finished
            testId="finished-job-list"
          />
        </details>
      )}

      {overview ? (
        <div className="mt-6 grid grid-cols-1 gap-x-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card title="Build these stories first">
              <StoryPlan order={overview.storyOrder} stories={stories} />
            </Card>
            {overview.shared.length > 0 && (
              <Card
                title={jobs.length > 1 ? "What your jobs share" : "What interviewers will probe"}
              >
                <Bullets items={overview.shared} />
              </Card>
            )}
          </div>

          <div>
            <ResumeCard resume={resume} />
            {overview.resumeFit && (
              <Card title="Resume against these jobs">
                {overview.resumeFit.strengths.length > 0 && (
                  <>
                    <h3 className="font-semibold text-slate-900">Already shows</h3>
                    <Bullets items={overview.resumeFit.strengths} />
                  </>
                )}
                {overview.resumeFit.gaps.length > 0 && (
                  <>
                    <h3 className="mt-4 font-semibold text-slate-900">Doesn&apos;t show yet</h3>
                    <Bullets items={overview.resumeFit.gaps} />
                    <p className="mt-2 text-sm text-slate-600">
                      Your stories are the place to cover these.
                    </p>
                  </>
                )}
              </Card>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-6 max-w-2xl">
          <ResumeCard resume={resume} />
        </div>
      )}
    </>
  );
}

type JobRead = NonNullable<Awaited<ReturnType<typeof getJobsPrep>>["overview"]>["jobs"][string];

type Overview = Awaited<ReturnType<typeof getJobsPrep>>["overview"];

const COLUMNS = "md:grid-cols-[minmax(0,1fr)_10rem_11rem_7.5rem]";

// Finished jobs get the same table with their outcome in place of the interview, and no count.
function JobTable({
  jobs,
  overview,
  stories,
  finished = false,
  testId,
}: {
  jobs: TargetJob[];
  overview: Overview;
  stories: StoryRecord[];
  finished?: boolean;
  testId: string;
}) {
  return (
    <div className={`${finished ? "mt-4" : "mt-8"} border-t border-ink-200`}>
      <div
        className={`hidden gap-x-6 border-b border-ink-100 py-2 text-xs text-slate-600 md:grid ${COLUMNS}`}
        aria-hidden="true"
      >
        <span>Job</span>
        <span>Level</span>
        <span>{finished ? "Outcome" : "Interview"}</span>
        <span className="text-right">{finished ? "" : "Questions ready"}</span>
      </div>
      <ul className="divide-y divide-ink-100" data-testid={testId}>
        {jobs.map((job) => (
          <JobRow key={job.id} job={job} read={overview?.jobs[job.id]} stories={stories} />
        ))}
      </ul>
    </div>
  );
}

// The title is the link; it covers the whole row, so the row opens the job wherever it's clicked.
function JobRow({
  job,
  read,
  stories,
}: {
  job: TargetJob;
  read: JobRead | undefined;
  stories: StoryRecord[];
}) {
  const readiness = questionReadiness(job.likelyQuestions?.questions, stories);
  const round = roundLabel(job.nextStage);
  return (
    <li className={`group/job relative grid gap-x-6 gap-y-1 py-4 md:items-baseline ${COLUMNS}`}>
      <div className="min-w-0">
        <Link
          href={`/jobs/${job.id}`}
          className="font-semibold text-slate-900 group-hover/job:underline after:absolute after:inset-0"
        >
          {job.title}
        </Link>
        {job.company && <span className="text-slate-600"> at {job.company}</span>}
        {job.otherRoles.length > 0 && (
          <p className="mt-0.5 text-sm text-slate-600">
            Also up for: {job.otherRoles.map((r) => r.title).join(" · ")}
          </p>
        )}
        {read?.summary && <p className="mt-1 text-sm text-slate-600">{read.summary}</p>}
        {read?.differs && <p className="mt-1 text-sm text-slate-600">{read.differs}</p>}
      </div>
      {/* One wrapped line on a phone; three columns from md up. */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 md:contents">
        <p className="text-sm text-slate-700">
          {levelLabel(job.level) ?? "Level not set"}
          {!job.levelConfirmed && <span className="block text-amber-800">Not confirmed</span>}
        </p>
        <p className="text-sm text-slate-700">
          {job.outcome ? (
            <span
              className={job.outcome === "offer" ? "text-emerald-800" : undefined}
              data-testid="job-outcome-badge"
            >
              {outcomeSummary(job)}
            </span>
          ) : job.interviewDate ? (
            <>
              {dateLabel(job.interviewDate, "short")}
              {round && <span className="block text-slate-600">{round}</span>}
            </>
          ) : (
            <span className="text-slate-500">No date yet</span>
          )}
        </p>
        <p className="text-sm text-slate-700 tabular-nums md:text-right">
          {job.outcome ? null : readiness.total > 0 ? (
            <>
              <span className="md:hidden">Questions ready: </span>
              {readiness.ready} of {readiness.total}
            </>
          ) : (
            <span className="text-slate-500">Not predicted</span>
          )}
        </p>
      </div>
    </li>
  );
}

function ResumeCard({ resume }: { resume: Awaited<ReturnType<typeof getJobsPrep>>["resume"] }) {
  return (
    <Card title="Resume">
      {resume ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-slate-700" data-testid="resume-name">
            {resume.fileName || "Pasted resume"}
          </p>
          <form action={removeResume}>
            <PendingButton
              pendingText="Removing…"
              className="text-sm font-medium text-slate-600 hover:text-red-700"
            >
              Remove
            </PendingButton>
          </form>
        </div>
      ) : (
        <p className="mb-4 text-slate-600">
          Optional. It matches your history to each job, and it stays private to you.
        </p>
      )}
      <ResumeForm hasResume={Boolean(resume)} />
    </Card>
  );
}

function Card({
  title,
  className = "",
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`panel ${className}`}>
      <h2 className="mb-4 text-sm font-semibold text-ink-800">{title}</h2>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

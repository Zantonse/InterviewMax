import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { StoryPlan } from "@/components/story-plan";
import { MAX_JOBS, levelLabel, overviewBasis } from "@/lib/jobs/content";
import { getJobsPrep, listJobs } from "@/lib/jobs/data";
import { listStories } from "@/lib/stories/data";
import { removeResume } from "./actions";
import { AddJobForm, PendingButton, RereadButton, ResumeForm } from "./forms";

export const metadata: Metadata = { title: "Target jobs · InterviewMax" };

// Saving a resume reads every job again, which is a model call.
export const maxDuration = 120;

export default function JobsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/" className="text-sm font-medium text-teal-800 hover:underline">
          ← Back to your prep
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Your target jobs
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Paste in the jobs you&apos;re going for. I&apos;ll read them with your resume, find what
          they share and where each differs, and tell you which stories to build first.
        </p>
        <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-3xl bg-white/80" />}>
          <JobsContent />
        </Suspense>
      </main>
    </div>
  );
}

async function JobsContent() {
  const [jobs, { resume, overview }, stories] = await Promise.all([
    listJobs(),
    getJobsPrep(),
    listStories(),
  ]);

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

  return (
    <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {stale && (
          <Card title="Not read yet" className="bg-amber-50">
            <p className="mb-4 text-slate-700">
              Your jobs or resume changed since I last read them, so what&apos;s below may be out of
              date.
            </p>
            <RereadButton />
          </Card>
        )}

        <ul className="space-y-3" data-testid="job-list">
          {jobs.map((job) => {
            const read = overview?.jobs[job.id];
            return (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="block rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition hover:ring-teal-700/40"
                >
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-lg font-bold text-slate-900">
                      {job.title}
                      {job.company && (
                        <span className="font-normal text-slate-600"> at {job.company}</span>
                      )}
                    </span>
                    <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-900">
                      {levelLabel(job.level) ?? "Level not set"}
                      {!job.levelConfirmed && " · confirm"}
                    </span>
                  </span>
                  {read?.summary && <span className="mt-2 block text-slate-600">{read.summary}</span>}
                  {read?.differs && (
                    <span className="mt-1 block text-sm text-slate-500">{read.differs}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {overview && overview.shared.length > 0 && (
          <Card title={jobs.length > 1 ? "What your jobs share" : "What interviewers will probe"}>
            <Bullets items={overview.shared} />
          </Card>
        )}

        {overview && (
          <Card title="Build these stories first">
            <StoryPlan order={overview.storyOrder} stories={stories} />
          </Card>
        )}

        {jobs.length < MAX_JOBS && (
          <details className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <summary className="cursor-pointer text-sm font-bold uppercase tracking-wide text-teal-800">
              Add another job
            </summary>
            <div className="mt-4">
              <AddJobForm />
            </div>
          </details>
        )}
      </div>

      <div className="space-y-4">
        <ResumeCard resume={resume} />
        {overview?.resumeFit && (
          <Card title="Your resume against these jobs">
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
                <p className="mt-2 text-sm text-slate-500">
                  Your stories are the place to cover these.
                </p>
              </>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function ResumeCard({ resume }: { resume: Awaited<ReturnType<typeof getJobsPrep>>["resume"] }) {
  return (
    <Card title="Your resume">
      {resume ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-slate-700" data-testid="resume-name">
            {resume.fileName || "Pasted resume"}
          </p>
          <form action={removeResume}>
            <PendingButton
              pendingText="Removing…"
              className="text-sm font-medium text-slate-500 hover:text-red-700"
            >
              Remove
            </PendingButton>
          </form>
        </div>
      ) : (
        <p className="mb-4 text-slate-600">
          Optional, but it lets me match your history to each job. It stays private to you.
        </p>
      )}
      <ResumeForm hasResume={Boolean(resume)} />
    </Card>
  );
}

function Card({
  title,
  className = "bg-white",
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-3xl p-6 shadow-sm ring-1 ring-black/5 ${className}`}>
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-teal-800">{title}</h2>
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

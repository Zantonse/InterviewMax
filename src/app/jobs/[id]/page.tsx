import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { QuestionList } from "@/components/question-list";
import { getJob, getJobsPrep } from "@/lib/jobs/data";
import { listStories } from "@/lib/stories/data";
import { removeJob } from "../actions";
import { LevelForm, PendingButton, PredictForm } from "../forms";

export const metadata: Metadata = { title: "Target job · InterviewMax" };

// Predicting questions and removing a job (which reads the remaining jobs again) are model calls.
export const maxDuration = 120;

export default function JobPage({ params }: PageProps<"/jobs/[id]">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/jobs" className="text-sm font-medium text-teal-800 hover:underline">
          ← All target jobs
        </Link>
        <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-3xl bg-white/80" />}>
          <JobContent params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function JobContent({ params }: { params: PageProps<"/jobs/[id]">["params"] }) {
  const { id } = await params;
  const [job, { overview, resume }, stories] = await Promise.all([
    getJob(id),
    getJobsPrep(),
    listStories(),
  ]);
  if (!job) notFound();
  const read = overview?.jobs[job.id];

  return (
    <>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
        {job.title}
        {job.company && <span className="font-bold text-slate-500"> at {job.company}</span>}
      </h1>
      {read?.summary && <p className="mt-2 max-w-2xl text-slate-600">{read.summary}</p>}

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-teal-800">
              Likely questions
            </h2>
            {job.likelyQuestions ? (
              <>
                <p className="mb-4 text-sm text-slate-600">
                  Most likely first. Each one points to the story that answers it, or the one to
                  build.
                </p>
                <QuestionList questions={job.likelyQuestions.questions} stories={stories} />
              </>
            ) : (
              <p className="mb-4 text-slate-600">
                I&apos;ll predict the behavioral questions this job is most likely to ask, from the
                posting and any interview reports you paste, and match each to your stories.
              </p>
            )}
            <p className="mt-4 text-sm text-slate-500">
              Had an earlier round for this job?{" "}
              <Link href="/transcripts" className="font-semibold text-teal-800 underline">
                Add its transcript
              </Link>{" "}
              and predict again: questions they asked you before go to the top.
            </p>
            <div className="mt-4">
              <PredictForm
                jobId={job.id}
                reports={job.interviewReports}
                predicted={Boolean(job.likelyQuestions)}
              />
            </div>
          </section>
          {read && read.focus.length > 0 && (
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-teal-800">
                What their interviewers will look for
              </h2>
              <ul className="list-disc space-y-1 pl-5 text-slate-700" data-testid="job-focus">
                {read.focus.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {read.differs && <p className="mt-4 text-sm text-slate-500">{read.differs}</p>}
            </section>
          )}
          {!read && (
            <section className="rounded-3xl bg-amber-50 p-6 ring-1 ring-black/5">
              <p className="text-slate-700">
                I haven&apos;t read this job yet.{" "}
                <Link href="/jobs" className="font-semibold text-teal-800 underline">
                  Read your jobs
                </Link>{" "}
                from the jobs page.
              </p>
            </section>
          )}
          <details className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <summary className="cursor-pointer text-sm font-bold uppercase tracking-wide text-teal-800">
              The posting
            </summary>
            <p className="mt-4 whitespace-pre-line text-slate-700">{job.description}</p>
          </details>
        </div>

        <div className="space-y-4">
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-teal-800">
              Role level
            </h2>
            <p className="mb-4 text-sm text-slate-600">
              The level sets how senior your stories need to sound and which tier to aim for.
            </p>
            <LevelForm jobId={job.id} level={job.level} confirmed={job.levelConfirmed} />
          </section>
          {!resume && job.likelyQuestions && (
            <section
              className="rounded-3xl bg-teal-50 p-6 ring-1 ring-teal-800/10"
              data-testid="offer-resume"
            >
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-teal-800">
                Optional: add your resume
              </h2>
              <p className="text-sm text-slate-700">
                I&apos;ll check it against this job: what your history already shows, and what your
                stories need to cover.
              </p>
              <Link
                href="/jobs"
                className="mt-3 inline-block text-sm font-semibold text-teal-800 hover:underline"
              >
                Add your resume →
              </Link>
            </section>
          )}
          <form action={removeJob}>
            <input type="hidden" name="jobId" value={job.id} />
            <PendingButton
              pendingText="Removing…"
              className="text-sm font-medium text-slate-500 hover:text-red-700"
            >
              Remove this job
            </PendingButton>
          </form>
        </div>
      </div>
    </>
  );
}

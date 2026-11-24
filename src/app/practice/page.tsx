import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { StartPracticeForm } from "@/app/practice/start-form";
import { listJobs } from "@/lib/jobs/data";
import { folderLabel } from "@/lib/jobs/folder";
import { openJobs } from "@/lib/jobs/outcome";
import { currentItemIndex, isScreenRound } from "@/lib/practice/content";
import { listPracticeSessionsSafely } from "@/lib/practice/data";
import { daysUntil, focusJob, todayIn, whenLabel } from "@/lib/prep/plan";

export const metadata: Metadata = { title: "Practice · InterviewMax" };

// Practice from the sidebar (design review 2026-11-16, fix 6): start a round for the job with the
// nearest interview, or pick another job, and every past round across jobs. A job's own practice
// page (/jobs/[id]/practice) still shows that round's questions before it starts.
export default function PracticePage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 *:max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Practice out loud
        </h1>
        <p className="mt-2 text-slate-600">
          Answer your likely questions out loud, take the follow-ups a real interviewer would ask, and
          see what to fix.
        </p>
        <Suspense fallback={<div className="mt-8 h-48 animate-pulse rounded-3xl bg-white/80" />}>
          <Content />
        </Suspense>
      </main>
    </div>
  );
}

async function Content() {
  const [jobs, sessions, requestHeaders] = await Promise.all([
    listJobs(),
    listPracticeSessionsSafely(),
    headers(),
  ]);
  const today = todayIn(requestHeaders.get("x-vercel-ip-timezone"));
  const job = focusJob(jobs, today);
  const others = openJobs(jobs).filter((j) => j.id !== job?.id);
  const names = new Map(jobs.map((j) => [j.id, folderLabel(j)]));
  const days = job?.interviewDate ? daysUntil(job.interviewDate, today) : null;
  const inProgress = job
    ? sessions.find((s) => s.targetJobId === job.id && currentItemIndex(s.items) >= 0)
    : undefined;

  return (
    <>
      {!job ? (
        <section className="mt-6 panel">
          <p className="text-slate-700">
            Practice asks a job&apos;s likely questions, so it starts with a job you&apos;re going
            for.
          </p>
          <Link href="/jobs/new" className="btn-next mt-4">
            Add a job
          </Link>
        </section>
      ) : (
        <section
          className="mt-6 panel"
          data-testid="practice-hub-start"
        >
          <h2 className="text-lg font-semibold text-slate-900">{folderLabel(job)}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {days !== null && days >= 0
              ? `Interview ${whenLabel(days)}. `
              : ""}
            {job.likelyQuestions
              ? "A round asks the questions you're least ready for first."
              : "Predict this job's likely questions first. Practice uses them."}
          </p>
          <div className="mt-4 flex flex-wrap items-start gap-3">
            {!job.likelyQuestions ? (
              <Link href={`/jobs/${job.id}#questions`} className="btn-next">
                See the likely questions
              </Link>
            ) : inProgress ? (
              <>
                <Link href={`/practice/${inProgress.id}`} className="btn-next">
                  Carry on with your round
                </Link>
                <StartPracticeForm jobId={job.id} label="Start a new round" secondary />
              </>
            ) : (
              <StartPracticeForm jobId={job.id} label="Start a round" />
            )}
            {job.likelyQuestions && (
              <Link
                href={`/jobs/${job.id}/practice`}
                className="self-center text-sm link"
              >
                See the questions first
              </Link>
            )}
          </div>
          {others.length > 0 && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-600">Or practice for another job</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {others.map((j) => (
                  <li key={j.id}>
                    <Link
                      href={`/jobs/${j.id}/practice`}
                      className="inline-flex min-h-9 items-center rounded-full bg-white px-3 py-1.5 text-sm font-medium text-ink-800 ring-1 ring-slate-300 hover:bg-ink-50"
                    >
                      {folderLabel(j)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section
        id="past-rounds"
        className="mt-4 scroll-mt-20 panel"
      >
        <h2 className="text-lg font-semibold text-slate-900">Past rounds</h2>
        {sessions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            No rounds yet. Your first one shows up here with its feedback.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100" data-testid="practice-hub-rounds">
            {sessions.map((s) => {
              const answered = s.items.filter((i) => i.feedback).length;
              const open = currentItemIndex(s.items) >= 0;
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                  <Link href={`/practice/${s.id}`} className="font-semibold text-ink-800 hover:underline">
                    {new Date(s.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </Link>
                  <span className="min-w-0 text-sm text-slate-600">
                    {names.get(s.targetJobId) ?? "A removed job"} ·{" "}
                    {isScreenRound(s.items) ? "AI screen · " : ""}
                    {answered} of {s.items.length} answered{open ? " · in progress" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

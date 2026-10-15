import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { getAssessmentSafely } from "@/lib/assessment/data";
import { listJobs, type TargetJob } from "@/lib/jobs/data";
import { Quiz } from "./quiz";
import { JourneyResult } from "./result";

export const metadata: Metadata = { title: "Journey check · InterviewMax" };

// Adding a job from the result reads the posting and predicts its questions, which are model calls.
export const maxDuration = 120;

// The intake assessment: a new user's first step, and open to anyone later from home. Shows the
// last result if there is one, or the quiz.
export default function AssessmentPage({ searchParams }: PageProps<"/assessment">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Your journey check
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Five quick taps, and I&apos;ll grade where you are and show you what to do first.
        </p>
        <Suspense fallback={<div className="mt-6 h-96 max-w-2xl animate-pulse rounded-3xl bg-white/80" />}>
          <Assessment searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function Assessment({
  searchParams,
}: {
  searchParams: PageProps<"/assessment">["searchParams"];
}) {
  const [params, assessment, jobs] = await Promise.all([
    searchParams,
    getAssessmentSafely(),
    loadJobs(),
  ]);
  const hasJob = jobs.length > 0;
  const questionsJobId = jobs.find((j) => j.likelyQuestions)?.id;
  const taken = assessment && "answers" in assessment ? assessment : null;

  if (!taken || params.retake) {
    return (
      <Quiz
        key={params.retake ? "retake" : "first"}
        hasJob={hasJob} questionsJobId={questionsJobId} retake={Boolean(taken)}
      />
    );
  }
  return (
    <>
      <JourneyResult answers={taken.answers} hasJob={hasJob} questionsJobId={questionsJobId} />
      <p className="mt-4 text-sm text-slate-500">
        From {new Date(taken.completedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}.
        Jobs you&apos;ve added since count already.{" "}
        <Link href="/assessment?retake=1" className="font-semibold text-ink-800 hover:underline">
          Retake
        </Link>
      </p>
    </>
  );
}

async function loadJobs(): Promise<TargetJob[]> {
  try {
    return await listJobs();
  } catch (err) {
    unstable_rethrow(err);
    console.error("Assessment: loading target jobs failed", err);
    return [];
  }
}

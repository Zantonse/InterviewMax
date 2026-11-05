import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { getAssessmentSafely } from "@/lib/assessment/data";
import { knownProgress } from "@/lib/assessment/journey";
import { getCoachingStyleSafely } from "@/lib/coaching/data";
import { getUserFieldSafely } from "@/lib/field/data";
import { listJobs, type TargetJob } from "@/lib/jobs/data";
import { listStories } from "@/lib/stories/data";
import { type Picks, Quiz, STEP_COUNT } from "./quiz";
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
          {STEP_COUNT} quick taps, and I&apos;ll show you where you are and where to start.
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
  const [params, assessment, jobs, stories, field, style] = await Promise.all([
    searchParams,
    getAssessmentSafely(),
    loadJobs(),
    loadStories(),
    getUserFieldSafely(),
    getCoachingStyleSafely(),
  ]);
  const known = knownProgress(stories, jobs.length > 0);
  const questionsJobId = jobs.find((j) => j.likelyQuestions)?.id;
  const taken = assessment && "answers" in assessment ? assessment : null;

  if (!taken || params.retake) {
    // A retake shows the last answers and the saved settings as picked. A first go shows only a
    // field they chose themselves, never a guess.
    const initial: Picks = taken
      ? { ...taken.answers, field: field.id, coachingStyle: style }
      : field.guessed
        ? {}
        : { field: field.id };
    return (
      <Quiz
        key={params.retake ? "retake" : "first"}
        known={known}
        questionsJobId={questionsJobId}
        retake={Boolean(taken)}
        initial={initial}
      />
    );
  }
  return (
    <>
      <JourneyResult answers={taken.answers} known={known} questionsJobId={questionsJobId} />
      <p className="mt-4 text-sm text-slate-500">
        From {new Date(taken.completedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}.
        What you&apos;ve built since counts already.{" "}
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

async function loadStories() {
  try {
    return await listStories();
  } catch (err) {
    unstable_rethrow(err);
    console.error("Assessment: loading stories failed", err);
    return [];
  }
}

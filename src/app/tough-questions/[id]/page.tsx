import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { DeleteStoryButton } from "@/components/delete-story-button";
import { listJobs, type TargetJob } from "@/lib/jobs/data";
import { getStory } from "@/lib/stories/data";
import { getToughQuestion } from "@/lib/tough/questions";
import { ToughCoach } from "./coach";

export const metadata: Metadata = { title: "Tough question · InterviewMax" };

// Writing the answer is a model call, run as a Server Action from this page.
export const maxDuration = 120;

export default function ToughAnswerPage({ params }: PageProps<"/tough-questions/[id]">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 sm:py-6">
        <Link href="/tough-questions" className="text-sm font-medium text-ink-800 hover:underline">
          ← All tough questions
        </Link>
        <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-3xl bg-white/80" />}>
          <ToughLoader params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function ToughLoader({ params }: { params: PageProps<"/tough-questions/[id]">["params"] }) {
  const { id } = await params;
  const story = await getStory(id);
  if (!story) notFound();
  const question = getToughQuestion(story.storyType);
  if (!question) redirect(`/stories/${story.id}`);
  const jobs = await listJobs().catch(() => [] as TargetJob[]);
  return (
    <>
      <ToughCoach
        storyId={story.id}
        questionId={question.id}
        initialContent={story.content}
        jobs={jobs.map((j) => ({ id: j.id, label: j.company ? `${j.title}, ${j.company}` : j.title }))}
      />
      <details className="mt-8 max-w-xl rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
          Start this one over
        </summary>
        <div className="mt-3">
          <DeleteStoryButton storyId={story.id} title={story.title} />
        </div>
      </details>
    </>
  );
}

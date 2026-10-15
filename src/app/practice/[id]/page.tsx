import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { getJob } from "@/lib/jobs/data";
import { getPracticeSession } from "@/lib/practice/data";
import { PracticeRunner } from "./runner";

export const metadata: Metadata = { title: "Practice · InterviewMax" };

// The interviewer's follow-ups and the feedback are model calls.
export const maxDuration = 120;

export default function PracticePage({ params }: PageProps<"/practice/[id]">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-3xl bg-white/80" />}>
          <PracticeContent params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function PracticeContent({ params }: { params: PageProps<"/practice/[id]">["params"] }) {
  const { id } = await params;
  const session = await getPracticeSession(id);
  if (!session) notFound();
  const job = await getJob(session.targetJobId);
  if (!job) notFound();
  return (
    <>
      <Link
        href={`/jobs/${job.id}/practice`}
        className="text-sm font-medium text-ink-800 hover:underline"
      >
        ← Practice for {job.title}
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
        Practice out loud
      </h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        {job.title}
        {job.company ? ` at ${job.company}` : ""}. Answer each question as you would in the room;
        the interviewer follows up on the weakest part.
      </p>
      <PracticeRunner sessionId={session.id} jobId={job.id} initialItems={session.items} />
    </>
  );
}

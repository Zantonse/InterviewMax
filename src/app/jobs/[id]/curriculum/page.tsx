import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { BetaBadge } from "@/app/promotion/beta-badge";
import { getCurrentUser } from "@/lib/auth";
import { canUseCurriculum } from "@/lib/curriculum/access";
import { getJob } from "@/lib/jobs/data";
import { CurriculumView } from "./curriculum-view";

export const metadata: Metadata = { title: "Curriculum · InterviewMax" };

// Writing the curriculum is a model call.
export const maxDuration = 120;

// Curriculum (beta): the basics of one target job, so the user knows which topics to have down
// before the interviews. Admin-only while in beta (see src/lib/curriculum/access.ts).
export default function CurriculumPage({ params }: PageProps<"/jobs/[id]/curriculum">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-3xl bg-white/80" />}>
          <Content params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function Content({ params }: { params: PageProps<"/jobs/[id]/curriculum">["params"] }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!canUseCurriculum(user.email)) notFound();
  const job = await getJob(id);
  if (!job) notFound();

  return (
    <>
      <Link href={`/jobs/${job.id}`} className="text-sm font-medium text-ink-800 hover:underline">
        ← {job.title}
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Curriculum
        </h1>
        <BetaBadge />
      </div>
      <p className="mt-2 max-w-2xl text-slate-600">
        The basics of {job.title}
        {job.company ? ` at ${job.company}` : ""}: the topics an interviewer will expect you to
        know, what to know about each, and a question to test yourself. Mark each one as you go.
      </p>
      <CurriculumView
        jobId={job.id}
        hasPosting={job.description.trim().length > 0}
        initial={job.curriculum}
      />
    </>
  );
}

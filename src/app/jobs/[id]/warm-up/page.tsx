import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { buildBrief, warmUpCards } from "@/lib/brief/brief";
import { getJob } from "@/lib/jobs/data";
import { getNumbersChecklistSafely } from "@/lib/numbers/data";
import { listStories } from "@/lib/stories/data";
import { WarmUp } from "./warm-up";

export const metadata: Metadata = { title: "One-minute warm-up · InterviewMax" };

// The one-minute warm-up (PRD v0.3, with the pre-interview brief): for the hour before the
// interview, About me, three key numbers and the top questions with their stories, one card at a
// time. Full screen, without the sidebar, so nothing else competes for attention.
export default function WarmUpPage({ params }: PageProps<"/jobs/[id]/warm-up">) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-ink-900 px-4 py-6 sm:px-6">
      <Suspense
        fallback={
          <div className="mx-auto mt-16 h-80 w-full max-w-2xl animate-pulse rounded-3xl bg-white/10" />
        }
      >
        <Content params={params} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: { params: PageProps<"/jobs/[id]/warm-up">["params"] }) {
  const { id } = await params;
  const [job, stories, numbers] = await Promise.all([
    getJob(id),
    listStories(),
    getNumbersChecklistSafely(),
  ]);
  if (!job) notFound();
  const brief = buildBrief({ job, stories, numbers });
  const cards = warmUpCards(brief);
  const exit = `/jobs/${job.id}/brief`;

  if (cards.length === 0) {
    return (
      <div className="mx-auto mt-16 w-full max-w-2xl rounded-3xl bg-white p-8 text-center">
        <p className="text-slate-700">
          Nothing to warm up with yet. Write your About me and predict this job&apos;s likely
          questions first.
        </p>
        <Link
          href={`/jobs/${job.id}`}
          className="mt-4 inline-block font-semibold text-ink-800 underline"
        >
          Back to {job.title}
        </Link>
      </div>
    );
  }

  return <WarmUp cards={cards} company={job.company || job.title} exitHref={exit} />;
}

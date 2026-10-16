import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { buildBrief } from "@/lib/brief/brief";
import { getJob } from "@/lib/jobs/data";
import { getNumbersChecklistSafely } from "@/lib/numbers/data";
import { daysUntil, todayIn } from "@/lib/prep/plan";
import { listStories } from "@/lib/stories/data";
import { BriefView } from "./brief-view";
import { trackEvent } from "@/lib/usage/track";

export const metadata: Metadata = { title: "Pre-interview brief · InterviewMax" };

// The pre-interview brief (PRD v0.3, P0): one page per job to read just before walking in. Built
// from the user's own data in code (see src/lib/brief), reads well on a phone and prints on a page.
export default function BriefPage({ params }: PageProps<"/jobs/[id]/brief">) {
  return (
    <div className="flex flex-1 flex-col print:bg-white">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12 print:max-w-none print:p-0 print:text-xs">
        <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-3xl bg-white/80" />}>
          <Content params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function Content({ params }: { params: PageProps<"/jobs/[id]/brief">["params"] }) {
  const { id } = await params;
  const [job, stories, numbers, requestHeaders] = await Promise.all([
    getJob(id),
    listStories(),
    getNumbersChecklistSafely(),
    headers(),
  ]);
  if (!job) notFound();
  await trackEvent("brief_opened");
  const brief = buildBrief({ job, stories, numbers });
  const today = todayIn(requestHeaders.get("x-vercel-ip-timezone"));
  const days =
    job.interviewDate && daysUntil(job.interviewDate, today) >= 0
      ? daysUntil(job.interviewDate, today)
      : null;
  return <BriefView brief={brief} days={days} />;
}

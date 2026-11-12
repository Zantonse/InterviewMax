import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { listPracticeSessionsSafely } from "@/lib/practice/data";
import { buildRecap } from "@/lib/recap/recap";
import { listStories } from "@/lib/stories/data";
import { RecapCard } from "./recap-card";

export const metadata: Metadata = { title: "Your prep recap · InterviewMax" };

export default function RecapPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/" className="text-sm font-medium text-ink-800 hover:underline">
          ← Back to your prep
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Your prep so far
        </h1>
        <Suspense fallback={<div className="mx-auto mt-8 h-[32rem] max-w-sm animate-pulse rounded-[2rem] bg-white/80" />}>
          <Content />
        </Suspense>
      </main>
    </div>
  );
}

async function Content() {
  const [stories, sessions] = await Promise.all([listStories(), listPracticeSessionsSafely()]);
  const recap = buildRecap(stories, sessions);
  if (!recap) {
    return (
      <p className="mt-6 rounded-2xl bg-white p-6 text-slate-600 shadow-sm ring-1 ring-black/5">
        Your recap appears once you&apos;ve written your first behavioral story.{" "}
        <Link href="/" className="font-semibold text-ink-800 hover:underline">
          Build one →
        </Link>
      </p>
    );
  }
  return (
    <div className="mt-6 flex flex-col gap-4">
      <p className="text-slate-600">Save it as an image to share. Only you decide where it goes.</p>
      <RecapCard recap={recap} />
      {recap.nextGap && (
        <p className="text-center text-sm text-slate-600" data-testid="recap-next">
          Next up: a story for <span className="font-semibold text-slate-900">{recap.nextGap}</span>.
        </p>
      )}
    </div>
  );
}

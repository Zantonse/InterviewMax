import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { listPracticeSessionsSafely } from "@/lib/practice/data";
import { buildRecap } from "@/lib/recap/recap";
import { listStories } from "@/lib/stories/data";
import { RecapCard } from "./recap-card";

export const metadata: Metadata = { title: "Prep recap · InterviewMax" };

export default function RecapPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 *:max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Prep so far
        </h1>
        <Suspense fallback={<div className="mt-6 h-[30rem] max-w-md animate-pulse rounded-[10px] bg-ink-50" />}>
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
      <p className="mt-6 panel text-slate-600">
        Your recap appears once you&apos;ve written your first behavioral story.{" "}
        <Link href="/" className="link">
          Build one
        </Link>
      </p>
    );
  }
  return (
    <div className="mt-6 flex flex-col gap-4">
      <p className="text-slate-600">Save it as an image to share. Only you decide where it goes.</p>
      <RecapCard recap={recap} />
      {recap.nextGap && (
        <p className="text-sm text-slate-600" data-testid="recap-next">
          Next up: a story for <span className="font-semibold text-slate-900">{recap.nextGap}</span>.
        </p>
      )}
    </div>
  );
}

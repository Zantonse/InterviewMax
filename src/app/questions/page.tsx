import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { listJobs } from "@/lib/jobs/data";
import { coverageFor } from "@/lib/questions/coverage";
import { buildLibrary } from "@/lib/questions/library";
import { QUESTION_THEMES } from "@/lib/questions/themes";
import { listStories } from "@/lib/stories/data";
import { getStoryType } from "@/lib/stories/story-types";
import { listTranscriptsForPrep } from "@/lib/transcripts/data";
import { LibraryView, type LibraryItem } from "./library-view";

export const metadata: Metadata = { title: "Question library · InterviewMax" };

// The question library (PRD v0.3, P1): every common behavioral question by theme, with the user's
// own likely and past-interview questions first, and the story that answers each one.
export default function QuestionsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/" className="text-sm font-medium text-ink-800 hover:underline">
          ← Back to your prep
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Question library
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          The behavioral questions interviewers ask most, by theme, with the story you&apos;d answer
          each one with. Questions likely for your target jobs and ones you were asked before come
          first.
        </p>
        <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-3xl bg-white/80" />}>
          <LibraryContent />
        </Suspense>
      </main>
    </div>
  );
}

async function LibraryContent() {
  const [jobs, stories, transcripts] = await Promise.all([
    listJobs(),
    listStories(),
    listTranscriptsForPrep(),
  ]);
  const entries = buildLibrary({
    jobs,
    transcripts: transcripts.map((t) => ({ id: t.id, title: t.title, asked: t.analysis?.asked ?? [] })),
  });
  const items: LibraryItem[] = entries.map((e) => {
    const coverage = coverageFor(e.theme, stories);
    return {
      ...e,
      coverage:
        coverage?.kind === "story"
          ? { kind: "story", storyId: coverage.storyId, title: coverage.title, drafted: coverage.drafted }
          : {
              kind: "build",
              storyType: coverage?.storyType ?? "major_project",
              label: getStoryType(coverage?.storyType)?.label ?? "a story",
            },
    };
  });
  return (
    <LibraryView
      items={items}
      themes={QUESTION_THEMES.map((t) => ({ id: t.id, label: t.label }))}
    />
  );
}

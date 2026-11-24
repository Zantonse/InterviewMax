import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import {
  SOURCE_LABELS,
  finderBasis,
  groupMoments,
  type FinderSource,
  type StoryFinder,
} from "@/lib/finder/content";
import { getStoryFinder } from "@/lib/finder/data";
import { finderSources } from "@/lib/finder/find";
import { themeCoverage } from "@/lib/stories/bank";
import { listStories } from "@/lib/stories/data";
import { AutoFind, FindAgainButton, MomentButton, QuickQuestions } from "./forms";
import { startFromMoment } from "./actions";

export const metadata: Metadata = { title: "Find a story · InterviewMax" };

// Finding moments is a model call, run as a Server Action from this page.
export const maxDuration = 120;

export default function FindStoryPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/stories/new" className="text-sm font-medium text-ink-800 hover:underline">
          ← All story types
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          Stories you already have
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Most people have more stories than they think. These are moments from your own work that
          could answer common interview questions. Tap one to start building it. Nothing here
          becomes part of a story until you tell it in your words.
        </p>
        <Suspense fallback={<Skeleton />}>
          <Finder />
        </Suspense>
      </main>
    </div>
  );
}

async function Finder() {
  const [stories, finder] = await Promise.all([listStories(), getStoryFinder()]);
  const sources = await finderSources(stories, finder);

  if (sources.length === 0) {
    return (
      <section className="mt-8 max-w-2xl panel">
        <h2 className="text-lg font-semibold text-slate-900">Three quick questions</h2>
        <p className="mt-1 text-slate-600">
          There&apos;s no resume yet, so say a little about your recent work. A sentence or two
          each is plenty. Or{" "}
          <Link href="/jobs" className="link">
            add your resume
          </Link>{" "}
          and it&apos;s read instead.
        </p>
        <QuickQuestions initial={finder?.answers ?? {}} />
      </section>
    );
  }

  const moments = finder?.moments ?? [];
  if (moments.length === 0) {
    return <AutoFind reading={readingLabel(sources)} />;
  }

  const groups = groupMoments(moments, themeCoverage(stories));
  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Read from {readingLabel(sources)}.
          {isStale(finder, sources) && " It's changed since, so these may be out of date."}
        </p>
        <FindAgainButton />
      </div>
      <form action={startFromMoment} className="mt-4 space-y-6" data-testid="moment-groups">
        {groups.map((group) => (
          <section key={group.themeId} data-testid={`moments-${group.themeId}`}>
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              {group.label}
              {group.status === "empty" && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                  No story yet
                </span>
              )}
            </h2>
            <ul className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              {group.moments.map((m) => (
                <li key={m.id}>
                  <MomentButton
                    id={m.id}
                    moment={m.moment}
                    question={m.question}
                    quote={m.quote}
                    sourceLabel={SOURCE_LABELS[m.source]}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </form>
    </>
  );
}

function readingLabel(sources: FinderSource[]): string {
  const labels = sources.map((s) => SOURCE_LABELS[s.id]);
  return labels.length > 1
    ? `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`
    : labels[0];
}

function isStale(finder: StoryFinder | null, sources: FinderSource[]): boolean {
  return Boolean(finder?.basis) && finder?.basis !== finderBasis(sources);
}

function Skeleton() {
  return (
    <div className="mt-8 grid animate-pulse grid-cols-1 gap-3 md:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-28 rounded-3xl bg-white/80 ring-1 ring-ink-100" />
      ))}
    </div>
  );
}

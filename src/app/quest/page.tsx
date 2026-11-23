import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { JourneyCard } from "@/components/quest/journey-card";
import { RankCard } from "@/components/quest/rank-card";
import { SkillTree } from "@/components/quest/skill-tree";
import { loadQuestData, practiceHrefFor, type QuestData } from "@/lib/quest/data";
import { getJobsPrep } from "@/lib/jobs/data";
import { nextStoryToBuild } from "@/lib/guide/journey";
import { coreSixJourney, firstStoryJourney, weakestSkillJourney, type Cta } from "@/lib/quest/journeys";
import { questState } from "@/lib/quest/state";

export const metadata: Metadata = { title: "Story Quest · InterviewMax" };

// Story Quest (Craig, 2026-11-23): the game section. XP for making stories better, a rank, and
// journeys through the story builder, each with one next step. Everything is worked out from the
// user's stories, practice rounds and past interviews (src/lib/quest); nothing new is stored.
export default function QuestPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Story Quest
        </h1>
        <p className="mt-1 max-w-2xl text-slate-600">
          Earn XP by making your stories better. Each journey takes you through the story builder one
          step at a time.
        </p>
        <Suspense fallback={<div className="mt-5 h-40 animate-pulse rounded-3xl bg-white/80" />}>
          <QuestContent />
        </Suspense>
      </main>
    </div>
  );
}

async function QuestContent() {
  const [data, prep] = await Promise.all([
    loadQuestData(),
    getJobsPrep().catch(() => ({ overview: null })),
  ]);
  // The next story the user's jobs need, as on the finish line.
  const upNext = prep.overview
    ? nextStoryToBuild(prep.overview.storyOrder, data.stories, null)
    : undefined;
  const next: Cta | undefined = upNext
    ? {
        href: upNext.storyId ? `/stories/${upNext.storyId}` : `/stories/new/${upNext.storyType}`,
        label: upNext.storyId ? `Continue: ${upNext.label}` : `Start: ${upNext.label}`,
      }
    : undefined;
  return <QuestView data={data} next={next} />;
}

function QuestView({ data, next }: { data: QuestData; next?: Cta }) {
  const { aloud, xp, tree, map } = questState(data);
  const first = firstStoryJourney(data.stories, aloud);
  const journey = firstStoryJourney(
    data.stories,
    aloud,
    practiceHrefFor(first.storyId, data.jobs, data.stories),
  );
  const six = coreSixJourney(data.stories, aloud, next);
  const weak = weakestSkillJourney(map);
  // The journey the page leads with: your first story until it's said out loud, then the core six.
  const main = journey.done && !six.done ? six : journey;
  const others = [journey, six, weak].filter((j) => j !== main);
  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <RankCard xp={xp} />
      <JourneyCard journey={main} main />
      <div className="lg:col-span-2">
        <SkillTree branches={tree} />
      </div>
      <div className="lg:col-span-2">
        <h2 className="mt-2 text-lg font-bold text-slate-900">More journeys</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {others.map((j) => (
            <JourneyCard key={j.id} journey={j} />
          ))}
        </div>
      </div>
    </div>
  );
}

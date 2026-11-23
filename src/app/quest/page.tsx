import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { JourneyCard } from "@/components/quest/journey-card";
import { RankCard } from "@/components/quest/rank-card";
import { loadQuestData, practiceHrefFor, type QuestData } from "@/lib/quest/data";
import { firstStoryJourney } from "@/lib/quest/journeys";
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
  const data = await loadQuestData();
  return <QuestView data={data} />;
}

function QuestView({ data }: { data: QuestData }) {
  const { aloud, xp } = questState(data);
  const first = firstStoryJourney(data.stories, aloud);
  const journey = firstStoryJourney(
    data.stories,
    aloud,
    practiceHrefFor(first.storyId, data.jobs, data.stories),
  );
  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <RankCard xp={xp} />
      <JourneyCard journey={journey} main />
    </div>
  );
}

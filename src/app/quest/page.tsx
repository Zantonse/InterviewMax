import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { JourneyCard } from "@/components/quest/journey-card";
import { RankCard } from "@/components/quest/rank-card";
import { SkillTree } from "@/components/quest/skill-tree";
import { SectionHead } from "@/components/section-head";
import { loadQuestData, practiceHrefFor, type QuestData } from "@/lib/quest/data";
import { getJobsPrep } from "@/lib/jobs/data";
import { nextStoryToBuild } from "@/lib/guide/journey";
import { coreSixJourney, firstStoryJourney, weakestSkillJourney, type Cta } from "@/lib/quest/journeys";
import { bossState, jobJourney } from "@/lib/quest/boss";
import { questState } from "@/lib/quest/state";
import { focusJob, todayIn } from "@/lib/prep/plan";

export const metadata: Metadata = { title: "Story Quest · InterviewMax" };

// Story Quest (Craig, 2026-11-23): the game section. XP for making stories better, a rank, and
// journeys through the story builder, each with one next step. Everything is worked out from the
// user's stories, practice rounds and past interviews (src/lib/quest); nothing new is stored.
export default function QuestPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="page">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Story Quest</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Earn XP by making your stories better. Each journey takes you through the story builder one
          step at a time.
        </p>
        <Suspense fallback={<div className="mt-8 h-40 animate-pulse rounded-[10px] bg-ink-50" />}>
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
  const job = focusJob(data.jobs, todayIn((await headers()).get("x-vercel-ip-timezone")));
  return <QuestView data={data} next={next} job={job ?? undefined} />;
}

function QuestView({
  data,
  next,
  job,
}: {
  data: QuestData;
  next?: Cta;
  job?: QuestData["jobs"][number];
}) {
  const { aloud, xp, tree, map } = questState(data);
  const first = firstStoryJourney(data.stories, aloud);
  const journey = firstStoryJourney(
    data.stories,
    aloud,
    practiceHrefFor(first.storyId, data.jobs, data.stories),
  );
  const six = coreSixJourney(data.stories, aloud, next);
  const weak = weakestSkillJourney(map);
  const boss = job ? jobJourney(job, bossState(job, data.stories, data.sessions)) : undefined;
  // The journey the page leads with: your first story until it's said out loud, then the core six,
  // then the focus job's boss round.
  const main = !journey.done ? journey : !six.done ? six : boss && !boss.done ? boss : journey;
  const others = [journey, six, weak, ...(boss ? [boss] : [])].filter((j) => j !== main);
  const spoken = (j: { id: string }) => j.id === "boss";
  return (
    <>
      <div className="mt-10 grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
        <RankCard xp={xp} />
        <JourneyCard journey={main} main spoken={spoken(main)} />
      </div>
      <div className="mt-14">
        <SkillTree branches={tree} />
      </div>
      <section className="mt-14" aria-labelledby="journeys-heading">
        <SectionHead id="journeys-heading" title="More journeys" />
        <div className="mt-6 grid gap-x-10 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          {others.map((j) => (
            <JourneyCard key={j.id} journey={j} spoken={spoken(j)} />
          ))}
        </div>
      </section>
    </>
  );
}

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { shareWithCoach } from "@/app/promotion/actions";
import { getCoachSharing, getStory } from "@/lib/stories/data";
import { isToughType } from "@/lib/tough/questions";
import { BuilderLoader, BuilderSkeleton } from "./builder-loader";

export const metadata: Metadata = { title: "Story builder · InterviewMax" };

// The builder's model calls run as Server Actions on this page; writing a story can take a while.
export const maxDuration = 120;

export default function StoryPage({ params }: PageProps<"/stories/[id]">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-9">
        <Suspense fallback={<BuilderSkeleton />}>
          <StoryLoader params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function StoryLoader({ params }: { params: PageProps<"/stories/[id]">["params"] }) {
  const { id } = await params;
  const story = await getStory(id);
  if (!story) notFound();
  // Tough-question answers have their own coach page.
  if (isToughType(story.storyType)) redirect(`/tough-questions/${story.id}`);
  const sharing = await getCoachSharing(story.id).catch(() => null);
  return (
    <>
      {sharing && <CoachSharing storyId={story.id} shared={sharing.shared} />}
      <BuilderLoader story={story} />
    </>
  );
}

// PromotionMax stories: who can read this one. Hidden from the coach unless shared.
function CoachSharing({ storyId, shared }: { storyId: string; shared: boolean }) {
  return (
    <form
      action={shareWithCoach}
      className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink-100 pb-4 text-sm text-slate-700"
      data-testid="coach-sharing"
    >
      <input type="hidden" name="storyId" value={storyId} />
      <input type="hidden" name="shared" value={shared ? "false" : "true"} />
      <span>
        {shared
          ? "Promotion story, shared with your coach."
          : "Promotion story: private to you. Your coach can't read it."}
      </span>
      <button type="submit" className="link">
        {shared ? "Make it private again" : "Share with my coach"}
      </button>
    </form>
  );
}

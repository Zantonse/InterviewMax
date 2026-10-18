import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { getStory } from "@/lib/stories/data";
import { isToughType } from "@/lib/tough/questions";
import { BuilderLoader, BuilderSkeleton } from "./builder-loader";

export const metadata: Metadata = { title: "Story builder · InterviewMax" };

// The builder's model calls run as Server Actions on this page; writing a story can take a while.
export const maxDuration = 120;

export default function StoryPage({ params }: PageProps<"/stories/[id]">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 sm:py-6">
        <Link href="/" className="text-sm font-medium text-ink-800 hover:underline">
          ← Back to your prep
        </Link>
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
  return <BuilderLoader story={story} />;
}

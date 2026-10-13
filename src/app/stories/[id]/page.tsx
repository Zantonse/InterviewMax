import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { DeleteStoryButton } from "@/components/delete-story-button";
import { getStory } from "@/lib/stories/data";
import { REQUIRED_STORY_TYPE_ID } from "@/lib/stories/story-types";
import { StoryBuilder } from "./story-builder";

export const metadata: Metadata = { title: "Story builder · InterviewMax" };

// The builder's model calls run as Server Actions on this page; writing a story can take a while.
export const maxDuration = 120;

export default function StoryPage({ params }: PageProps<"/stories/[id]">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <Link href="/" className="text-sm font-medium text-teal-800 hover:underline">
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
  return (
    <>
      <StoryBuilder
        storyId={story.id}
        storyTypeId={story.storyType}
        initialTitle={story.title}
        initialContent={story.content}
      />
      <DeleteStoryButton
        storyId={story.id}
        title={story.title}
        required={story.storyType === REQUIRED_STORY_TYPE_ID}
      />
    </>
  );
}

function BuilderSkeleton() {
  return (
    <div className="mt-4 grid animate-pulse grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="h-96 rounded-3xl bg-white/80 ring-1 ring-black/5" />
      <div className="h-96 rounded-3xl bg-white/80 ring-1 ring-black/5" />
    </div>
  );
}

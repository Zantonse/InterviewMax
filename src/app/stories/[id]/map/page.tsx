import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { getStory } from "@/lib/stories/data";
import { getStoryType } from "@/lib/stories/story-types";
import { RoleMapper } from "./role-mapper";

export const metadata: Metadata = { title: "Map my role · InterviewMax" };

// Building a map for an unlisted role and writing the profile are model calls.
export const maxDuration = 120;

export default function MapRolePage({ params }: PageProps<"/stories/[id]/map">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-3xl bg-white/80" />}>
          <MapLoader params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function MapLoader({ params }: { params: PageProps<"/stories/[id]/map">["params"] }) {
  const { id } = await params;
  const story = await getStory(id);
  if (!story || getStoryType(story.storyType)?.format !== "intro") notFound();
  return (
    <>
      <Link
        href={`/stories/${story.id}`}
        className="text-sm font-medium text-teal-800 hover:underline"
      >
        ← Back to Tell me about yourself
      </Link>
      <RoleMapper storyId={story.id} initialMap={story.content.roleMap} />
    </>
  );
}

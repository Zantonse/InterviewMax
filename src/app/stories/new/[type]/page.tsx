import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { BuilderLoader, BuilderSkeleton } from "@/app/stories/[id]/builder-loader";
import { emptyContent } from "@/lib/stories/content";
import { cleanAsked, getStoryType } from "@/lib/stories/story-types";

export const metadata: Metadata = { title: "Story builder · InterviewMax" };

// The builder's model calls run as Server Actions on this page; writing a story can take a while.
export const maxDuration = 120;

// A new story, before anything is saved: the builder creates it with the first answer. ?q= is the
// interview question it answers, when it was started from one.
export default function NewStoryOfTypePage(props: PageProps<"/stories/new/[type]">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 sm:py-6">
        <Link href="/stories/new" className="text-sm font-medium text-ink-800 hover:underline">
          ← Pick a different story
        </Link>
        <Suspense fallback={<BuilderSkeleton />}>
          <NewStoryLoader {...props} />
        </Suspense>
      </main>
    </div>
  );
}

async function NewStoryLoader({ params, searchParams }: PageProps<"/stories/new/[type]">) {
  const [{ type }, query] = await Promise.all([params, searchParams]);
  const storyType = getStoryType(type);
  if (!storyType) notFound();
  // "Tell me about yourself" is saved as soon as it's started, from the picker.
  if (storyType.format === "intro") redirect("/stories/new");
  const asked = cleanAsked(query.q);
  return (
    <BuilderLoader
      story={{
        id: null,
        storyType: storyType.id,
        title: storyType.label,
        content: { ...emptyContent(), ...(asked ? { asked } : {}) },
      }}
    />
  );
}

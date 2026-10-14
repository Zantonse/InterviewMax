import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { requiredStoryStatus } from "@/lib/stories/required";
import { REQUIRED_STORY_TYPE_ID, STORY_TYPES } from "@/lib/stories/story-types";
import { startStory } from "./actions";
import { TypeButton } from "./type-button";

export const metadata: Metadata = { title: "Build a story · InterviewMax" };

export default function NewStoryPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/" className="text-sm font-medium text-navy-800 hover:underline">
          ← Back to your prep
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Which story do you want to build?
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Pick one. I&apos;ll ask you a few short questions about it, then two or three follow-ups,
          and write it from your answers. &ldquo;Tell me about yourself&rdquo; is a good place to
          start, since most interviews open with it, but you can build them in any order.
        </p>

        <Suspense fallback={<PickerSkeleton />}>
          <Picker />
        </Suspense>
      </main>
    </div>
  );
}

async function Picker() {
  const required = await requiredStoryStatus();
  return (
    <form action={startStory} className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {STORY_TYPES.map((type) => {
        if (type.id === REQUIRED_STORY_TYPE_ID) {
          return (
            <TypeButton
              key={type.id}
              id={type.id}
              label={type.label}
              blurb={type.blurb}
              badge={required.drafted ? "Written" : "Opens most interviews"}
              href={required.storyId ? `/stories/${required.storyId}` : undefined}
            />
          );
        }
        return <TypeButton key={type.id} id={type.id} label={type.label} blurb={type.blurb} />;
      })}
    </form>
  );
}

function PickerSkeleton() {
  return (
    <div className="mt-8 grid animate-pulse grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {STORY_TYPES.map((type) => (
        <div key={type.id} className="h-32 rounded-3xl bg-white/80 ring-1 ring-black/5" />
      ))}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { STORY_TYPES } from "@/lib/stories/story-types";
import { startStory } from "./actions";
import { TypeButton } from "./type-button";

export const metadata: Metadata = { title: "Build a story · InterviewMax" };

export default function NewStoryPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/" className="text-sm font-medium text-teal-800 hover:underline">
          ← Back to your prep
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Which story do you want to build?
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Pick one experience. I&apos;ll ask you eight short questions about it, then two or three
          follow-ups, and write the story from your answers.
        </p>

        <form action={startStory} className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STORY_TYPES.map((type) => (
            <TypeButton key={type.id} id={type.id} label={type.label} blurb={type.blurb} />
          ))}
        </form>
      </main>
    </div>
  );
}

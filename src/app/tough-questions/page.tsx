import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { PageGuide } from "@/components/page-guide";
import { hasDraft } from "@/lib/stories/content";
import { listStories } from "@/lib/stories/data";
import { TOUGH_QUESTIONS, toughStoryType } from "@/lib/tough/questions";
import { startTough } from "./actions";
import { StartToughButton } from "./start-button";

export const metadata: Metadata = { title: "Tough questions · InterviewMax" };

// The tough-questions coach (PRD v0.3, P0): pick one of the awkward questions, answer a few plain
// questions about your situation, and get a short honest answer to say out loud.
export default function ToughQuestionsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Tough questions
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          The questions people dread most are often the short ones. Prepare a true, brief answer
          for each, so you can say it calmly and move on to why you want the role.
        </p>
        <PageGuide
          id="tough-questions"
          steps={[
            "Pick a question you're worried about.",
            "Tell me what really happened, in plain words. Only what you say goes in the answer.",
            "Get a 20 to 40 second answer to edit and say out loud. It's saved with your stories.",
          ]}
        />
        <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-3xl bg-white/80" />}>
          <QuestionCards />
        </Suspense>
      </main>
    </div>
  );
}

async function QuestionCards() {
  const stories = await listStories();
  return (
    <form action={startTough} className="mt-8" data-testid="tough-questions">
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {TOUGH_QUESTIONS.map((q) => {
          const story = stories.find((s) => s.storyType === toughStoryType(q.id));
          const status = story ? (hasDraft(story.content) ? "written" : "started") : "new";
          return (
            <li key={q.id}>
              <StartToughButton id={q.id} label={q.label} blurb={q.blurb} status={status} />
            </li>
          );
        })}
      </ul>
    </form>
  );
}

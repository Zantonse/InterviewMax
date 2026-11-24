import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { unstable_rethrow } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { listJobs } from "@/lib/jobs/data";
import { questionsToBuild, type QuestionToBuild } from "@/lib/questions/coverage";
import { listStories } from "@/lib/stories/data";
import { requiredStoryStatus } from "@/lib/stories/required";
import { REQUIRED_STORY_TYPE_ID, STORY_TYPES, getStoryType } from "@/lib/stories/story-types";
import { startStory } from "./actions";
import { OwnQuestion, QuestionButton, TypeButton } from "./type-button";

export const metadata: Metadata = { title: "Build a story · InterviewMax" };

export default function NewStoryPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="page">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Which story do you want to build?
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Pick one and say what happened, your way: rough notes or a minute of talking. A rough
          draft is written straight away, then a few questions make it stronger. Nothing is saved
          until you answer.
        </p>

        <Suspense fallback={<PickerSkeleton />}>
          <Picker />
        </Suspense>
      </main>
    </div>
  );
}

// The likely questions for the user's jobs that no story answers yet: the most concrete place to
// start, since it's what they'll actually be asked. Hidden until a job has its questions.
async function loadQuestions(): Promise<{ questions: QuestionToBuild[]; hasJob: boolean }> {
  try {
    const [jobs, stories] = await Promise.all([listJobs(), listStories()]);
    return { questions: questionsToBuild(jobs, stories), hasJob: jobs.length > 0 };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Story picker: loading likely questions failed", err);
    // Unknown: don't nag about adding a job.
    return { questions: [], hasJob: true };
  }
}

// With no target job, a story can't be checked against the level it's for, and the likely
// questions above stay empty. Simulated juniors skipped adding one (2026-11-08), so it's offered
// here, where they start, without blocking the story.
function AddJobNudge() {
  return (
    <Link
      href="/jobs/new"
      className="mt-8 flex max-w-2xl items-center justify-between gap-4 rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-ink-700/30 transition hover:ring-ink-700/60"
      data-testid="add-job-nudge"
    >
      <span>
        <span className="block font-semibold text-slate-900">Add the job you&apos;re going for first</span>
        <span className="block text-sm text-slate-600">
          Paste the posting to see the questions it&apos;s likely to ask, and pitch your story at
          the level it expects.
        </span>
      </span>
      <span className="shrink-0 font-medium text-accent-700">Add a job</span>
    </Link>
  );
}

function JobQuestions({ questions }: { questions: QuestionToBuild[] }) {
  return (
    <section className="mt-8" data-testid="job-questions">
      <h2 className="text-lg font-semibold text-slate-900">Questions you&apos;re likely to be asked</h2>
      <p className="mt-1 text-sm text-slate-600">
        None of your stories answers these yet. Pick one to answer it with a story.
      </p>
      <ul className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2" data-stagger>
        {questions.map((q) => (
          <li key={q.question}>
            <form action={startStory} className="h-full">
              <input type="hidden" name="asked" value={q.question} />
              <QuestionButton
                storyType={q.storyType}
                question={q.question}
                note={`For ${q.job} · ${getStoryType(q.storyType)?.label}`}
              />
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function Picker() {
  const [required, { questions, hasJob }] = await Promise.all([
    requiredStoryStatus(),
    loadQuestions(),
  ]);
  return (
    <>
      {!hasJob && <AddJobNudge />}
      <section className="mt-8 max-w-2xl" data-testid="own-question-section">
        <h2 className="text-lg font-semibold text-slate-900">Have a question in mind?</h2>
        <p className="mt-1 text-sm text-slate-600">
          Type it the way you&apos;d be asked, and build the story that answers it.
        </p>
        <form action={startStory}>
          <OwnQuestion />
        </form>
      </section>
      {questions.length > 0 && <JobQuestions questions={questions} />}
      <Link
        href="/stories/find"
        className="mt-8 flex max-w-2xl items-center justify-between gap-4 rounded-2xl bg-white px-5 py-4 ring-1 ring-ink-100 transition hover:ring-ink-700/40"
        data-testid="find-stories-link"
      >
        <span>
          <span className="block font-semibold text-slate-900">
            Not sure which story to tell?
          </span>
          <span className="block text-sm text-slate-600">
            Moments from your resume that could answer each kind of question.
          </span>
        </span>
        <span className="shrink-0 font-medium text-accent-700">Find stories</span>
      </Link>
      <h2 className="mt-10 text-lg font-semibold text-slate-900">
        {questions.length > 0 ? "Or pick a kind of story" : "Pick a kind of story"}
      </h2>
      <form action={startStory} className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
    </>
  );
}

function PickerSkeleton() {
  return (
    <div className="mt-8 grid animate-pulse grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {STORY_TYPES.map((type) => (
        <div key={type.id} className="h-32 rounded-3xl bg-white/80 ring-1 ring-ink-100" />
      ))}
    </div>
  );
}

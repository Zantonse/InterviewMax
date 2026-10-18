import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { PageGuide } from "@/components/page-guide";
import { removePractice } from "@/app/practice/actions";
import { StartPracticeForm } from "@/app/practice/start-form";
import { getJob } from "@/lib/jobs/data";
import {
  REASON_LABELS,
  SCREEN_THINK_SECONDS,
  currentItemIndex,
  isScreenRound,
  pickQuestions,
} from "@/lib/practice/content";
import { listPracticeSessions } from "@/lib/practice/data";
import { listStories } from "@/lib/stories/data";

export const metadata: Metadata = { title: "Practice · InterviewMax" };

export default function JobPracticePage({ params }: PageProps<"/jobs/[id]/practice">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-3xl bg-white/80" />}>
          <Content params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function Content({ params }: { params: PageProps<"/jobs/[id]/practice">["params"] }) {
  const { id } = await params;
  const [job, stories, sessions] = await Promise.all([
    getJob(id),
    listStories(),
    listPracticeSessions(id),
  ]);
  if (!job) notFound();
  const round = job.likelyQuestions ? pickQuestions(job.likelyQuestions.questions, stories) : [];
  const inProgress = sessions.find((s) => !s.finishedAt && !isScreenRound(s.items));
  const screenInProgress = sessions.find((s) => !s.finishedAt && isScreenRound(s.items));

  return (
    <>
      <Link href={`/jobs/${job.id}`} className="text-sm font-medium text-ink-800 hover:underline">
        ← {job.title}
        {job.company ? ` at ${job.company}` : ""}
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
        Practice out loud
      </h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        A written story can still fall flat when it&apos;s said. Answer this job&apos;s likely
        questions out loud, take the follow-ups a real interviewer would ask, and see what to fix.
      </p>
      <PageGuide
        id="practice"
        steps={[
          "Tap Talk and answer each question as you would in the room. Typing works too.",
          "The interviewer drills two or three follow-ups deep: tell me more, why that, what would you do differently.",
          "Feedback on each answer: how close it stayed to your story, where it got thinner under the follow-ups, and your time.",
        ]}
      />

      {!job.likelyQuestions ? (
        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <p className="text-slate-700">
            First, predict this job&apos;s likely questions. Practice uses them.
          </p>
          <Link
            href={`/jobs/${job.id}#questions`}
            className="mt-3 inline-block font-semibold text-ink-800 hover:underline"
          >
            See the likely questions →
          </Link>
        </section>
      ) : (
        <section
          className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5"
          data-testid="practice-start"
        >
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-800">
            This round: {round.length} questions
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            The ones you&apos;re least ready for come first: questions with no story yet, then your
            weaker stories.
          </p>
          <ol className="mt-4 space-y-2">
            {round.map((q, i) => (
              <li key={q.question} className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-black/5">
                <p className="font-semibold text-slate-900">
                  <span className="mr-2 text-ink-800">{i + 1}.</span>
                  {q.question}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {REASON_LABELS[q.reason]}
                  {q.storyTitle ? ` · ${q.storyTitle}` : ""}
                </p>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap items-start gap-3">
            {inProgress ? (
              <>
                <Link
                  href={`/practice/${inProgress.id}`}
                  className="rounded-xl bg-accent-400 px-5 py-3 font-semibold text-ink-950 transition hover:bg-accent-300"
                >
                  Carry on with your round
                </Link>
                <StartPracticeForm jobId={job.id} label="Start a new round" secondary />
              </>
            ) : (
              <StartPracticeForm jobId={job.id} />
            )}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Find a quiet spot and allow the microphone when asked. What you say is written down to
            give feedback and kept with this job; you can remove a round at any time.
          </p>
        </section>
      )}

      {job.likelyQuestions && (
        <section
          className="mt-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5"
          data-testid="screen-start"
        >
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-800">
            Practice an AI screen
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Many first rounds are now a one-way interview with a bot: a question on screen,{" "}
            {SCREEN_THINK_SECONDS} seconds to think, then a time limit to answer, with no reactions
            and no follow-ups. Practice the same questions that way. Feedback at the end says
            whether each answer fit the time and got to its result without anyone asking.
          </p>
          <div className="mt-4 flex flex-wrap items-start gap-3">
            {screenInProgress && (
              <Link
                href={`/practice/${screenInProgress.id}`}
                className="rounded-xl bg-ink-800 px-5 py-3 font-semibold text-white hover:bg-ink-900"
              >
                Carry on with your screen
              </Link>
            )}
            <StartPracticeForm
              jobId={job.id}
              mode="screen"
              label={screenInProgress ? "Start a new screen" : "Start an AI screen"}
              secondary
            />
          </div>
        </section>
      )}

      {sessions.length > 0 && (
        <section className="mt-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-800">Your rounds</h2>
          <ul className="mt-3 divide-y divide-slate-100" data-testid="practice-rounds">
            {sessions.map((s) => {
              const answered = s.items.filter((i) => i.feedback).length;
              const open = currentItemIndex(s.items) >= 0;
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                  <Link
                    href={`/practice/${s.id}`}
                    className="font-semibold text-ink-800 hover:underline"
                  >
                    {new Date(s.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </Link>
                  <span className="text-sm text-slate-600">
                    {isScreenRound(s.items) ? "AI screen · " : ""}
                    {answered} of {s.items.length} answered{open ? " · in progress" : ""}
                  </span>
                  <form action={removePractice} className="ml-auto">
                    <input type="hidden" name="sessionId" value={s.id} />
                    <input type="hidden" name="jobId" value={job.id} />
                    <button
                      type="submit"
                      className="text-sm font-medium text-slate-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { AddJobForm } from "@/app/jobs/forms";
import { startStory } from "@/app/stories/new/actions";
import { type Answers, gradeJourney } from "@/lib/assessment/journey";
import { REQUIRED_STORY_TYPE_ID } from "@/lib/stories/story-types";

const PRIMARY =
  "inline-block rounded-xl bg-accent-400 px-4 py-2.5 font-semibold text-ink-950 transition hover:bg-accent-300 disabled:opacity-60";

// The journey grade, the biggest gaps, and the one step to take next, with that step right here so
// it's one tap (or, for a job, one paste) away.
export function JourneyResult({
  answers,
  hasJob,
  questionsJobId,
  notSaved = false,
}: {
  answers: Answers;
  hasJob: boolean;
  // A job whose likely questions are ready, for someone with nothing left to fix.
  questionsJobId?: string;
  notSaved?: boolean;
}) {
  const grade = gradeJourney(answers, { hasJob });
  return (
    <div className="mt-6 grid grid-cols-1 items-start gap-4 md:grid-cols-5" data-testid="journey-result">
      <section className="rounded-3xl bg-ink-800 p-6 text-white shadow-sm md:col-span-2">
        <h2 className="text-sm font-bold uppercase tracking-wide opacity-80">Journey grade</h2>
        <p className="mt-3 flex items-baseline gap-2">
          <span className="text-5xl font-extrabold" data-testid="journey-score">
            {grade.score}
          </span>
          <span className="text-ink-100">/ 100</span>
        </p>
        <p className="mt-1 text-lg font-semibold text-accent-300">{grade.level}</p>
        {grade.gaps.length > 0 ? (
          <>
            <p className="mt-5 text-sm font-semibold text-ink-100">Your biggest gaps</p>
            <ol className="mt-2 space-y-2">
              {grade.gaps.map((gap, i) => (
                <li key={gap.id} className="flex gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block font-semibold">{gap.title}</span>
                    <span className="block text-sm text-ink-100">{gap.why}</span>
                  </span>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="mt-5 text-ink-100">No big gaps. Time to practise out loud.</p>
        )}
        <p className="mt-6 text-sm text-ink-200">
          <Link href="/assessment?retake=1" className="underline hover:text-white">
            Retake
          </Link>
          {" · "}
          <Link href="/" className="underline hover:text-white">
            Go to your prep
          </Link>
        </p>
        {notSaved && (
          <p className="mt-3 text-xs text-ink-200" role="status">
            Your answers couldn&apos;t be saved this time, so you may be asked again.
          </p>
        )}
      </section>

      {/* On phones the step to take comes first; the grade follows. */}
      <section className="order-first rounded-3xl bg-white p-6 shadow-sm ring-2 ring-ink-700/40 sm:p-8 md:order-none md:col-span-3">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-700">Start here</p>
        {grade.urgent && (
          <p className="mt-1 text-sm text-slate-600">
            Your next interview is days away, so this starts with what can be ready in time.
          </p>
        )}
        <NextStep id={grade.next.id} questionsJobId={questionsJobId} />
      </section>
    </div>
  );
}

function NextStep({ id, questionsJobId }: { id: string; questionsJobId?: string }) {
  switch (id) {
    case "job":
      return (
        <>
          <Heading>See the questions they&apos;re likely to ask</Heading>
          <Lead>Paste the posting or a link. No resume needed.</Lead>
          <div className="mt-6">
            <AddJobForm submitLabel="Show my likely questions" />
          </div>
        </>
      );
    case "aboutMe":
      return (
        <>
          <Heading>Build your &ldquo;Tell me about yourself&rdquo;</Heading>
          <Lead>
            A few short questions about your path, then I&apos;ll write a 90-second answer from what
            you say. It&apos;s free.
          </Lead>
          <form action={startStory} className="mt-6 flex flex-wrap items-center gap-4">
            <input type="hidden" name="storyType" value={REQUIRED_STORY_TYPE_ID} />
            <StartButton />
            <Link href="/jobs/new" className="text-sm font-semibold text-ink-800 hover:underline">
              Or add a job first
            </Link>
          </form>
        </>
      );
    case "numbers":
      return (
        <>
          <Heading>Gather the numbers your stories need</Heading>
          <Lead>Pick your role and I&apos;ll list the figures interviewers look for.</Lead>
          <Go href="/numbers">Gather my numbers</Go>
        </>
      );
    case "stories":
      return (
        <>
          <Heading>Build a few more stories</Heading>
          <Lead>Pick a story type and answer a few short questions.</Lead>
          <Go href="/stories/new">Build a story</Go>
        </>
      );
    default:
      return (
        <>
          <Heading>Go over your likely questions</Heading>
          <Lead>Check each one has a story behind it, then say the answers out loud.</Lead>
          <Go href={questionsJobId ? `/jobs/${questionsJobId}` : "/jobs"}>See my questions</Go>
        </>
      );
  }
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">{children}</h2>
  );
}

function Lead({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-slate-600">{children}</p>;
}

function Go({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={`${PRIMARY} mt-6`}>
      {children}
    </Link>
  );
}

function StartButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={PRIMARY}>
      {pending ? "Starting…" : "Start my answer"}
    </button>
  );
}

import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { DeleteStoryButton } from "@/components/delete-story-button";
import { PrepPath } from "@/components/prep-path";
import { QuestionList } from "@/components/question-list";
import { WhyInterviewMax } from "@/components/why-interviewmax";
import { levelLabel } from "@/lib/jobs/content";
import { listJobs, type TargetJob } from "@/lib/jobs/data";
import { builderStage } from "@/lib/stories/content";
import { listStories, type StoryRecord } from "@/lib/stories/data";
import { getStoryType } from "@/lib/stories/story-types";
import { gapLabel, summarizeTranscripts } from "@/lib/transcripts/content";
import { listTranscripts, type Transcript } from "@/lib/transcripts/data";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Your interview prep
            </h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              Build one story at a time. Each one is drawn from your own answers, with your own
              numbers.
            </p>
          </div>
          <Link
            href="/stories/new"
            className="rounded-xl bg-teal-800 px-4 py-3 font-semibold text-white transition hover:bg-teal-900"
          >
            Build a story
          </Link>
        </div>

        <WhyInterviewMax className="mt-8" />

        <Suspense fallback={<div className="mt-8 h-24 animate-pulse rounded-3xl bg-white/80" />}>
          <PrepPath />
        </Suspense>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-[auto_auto_1fr]">
          <Card className="bg-teal-800 text-white md:col-span-2 md:row-span-3" title="Story bank">
            <Suspense fallback={<p className="text-5xl font-extrabold opacity-50">…</p>}>
              <StoryBank />
            </Suspense>
          </Card>
          <Card title="Target jobs">
            <Suspense fallback={<EmptyLine>…</EmptyLine>}>
              <TargetJobs />
            </Suspense>
          </Card>
          <Card title="Likely questions">
            <Suspense fallback={<EmptyLine>…</EmptyLine>}>
              <LikelyQuestions />
            </Suspense>
          </Card>
          <Card title="Past interviews">
            <Suspense fallback={<EmptyLine>…</EmptyLine>}>
              <PastInterviews />
            </Suspense>
          </Card>
        </div>
      </main>
    </div>
  );
}

async function StoryBank() {
  let stories: StoryRecord[];
  try {
    stories = await listStories();
  } catch (err) {
    // A signed-out redirect must still go through.
    unstable_rethrow(err);
    // Don't take the whole home page down if the database can't be read.
    console.error("Home: loading stories failed", err);
    return (
      <p className="max-w-md text-teal-50" role="alert" data-testid="story-bank-error">
        Your stories couldn&apos;t be loaded right now. Try again in a minute.
      </p>
    );
  }
  return (
    <>
      <p className="text-5xl font-extrabold" data-testid="story-count">
        {stories.length}
      </p>
      <p className="mt-1 text-teal-100">{stories.length === 1 ? "story" : "stories"} so far</p>
      {stories.length === 0 ? (
        <p className="mt-6 max-w-md text-teal-50">
          Every story you build is kept here. Everyone starts with &ldquo;Tell me about
          yourself&rdquo;: it&apos;s how almost every interview opens.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-white/15 rounded-2xl bg-white/10">
          {stories.map((story) => {
            const drafted =
              builderStage(story.content, getStoryType(story.storyType)) === "drafted";
            return (
              <li key={story.id} className="flex items-center gap-1 pr-2">
                <Link
                  href={`/stories/${story.id}`}
                  className="flex min-w-0 flex-1 items-center justify-between gap-4 px-4 py-3 hover:bg-white/10"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{story.title}</span>
                    <span className="block truncate text-sm text-teal-100">
                      {getStoryType(story.storyType)?.label ?? "Story"}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      drafted ? "bg-white text-teal-900" : "bg-teal-900/60 text-teal-50"
                    }`}
                  >
                    {drafted ? "Draft written" : "In progress"}
                  </span>
                </Link>
                <DeleteStoryButton storyId={story.id} title={story.title} variant="compact" />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

async function TargetJobs() {
  let jobs: TargetJob[];
  try {
    jobs = await listJobs();
  } catch (err) {
    unstable_rethrow(err);
    console.error("Home: loading target jobs failed", err);
    return <EmptyLine>Your target jobs couldn&apos;t be loaded right now.</EmptyLine>;
  }
  if (jobs.length === 0) {
    return (
      <>
        <EmptyLine>
          Paste in a job you&apos;re going for, and I&apos;ll tell you which stories to build first.
        </EmptyLine>
        <Link
          href="/jobs"
          className="mt-4 inline-block rounded-xl bg-teal-800 px-4 py-2.5 font-semibold text-white hover:bg-teal-900"
        >
          Add a target job
        </Link>
      </>
    );
  }
  return (
    <>
      <ul className="space-y-2" data-testid="home-jobs">
        {jobs.map((job) => (
          <li key={job.id}>
            <Link href={`/jobs/${job.id}`} className="block hover:text-teal-800">
              <span className="block truncate font-semibold">{job.title}</span>
              <span className="block truncate text-sm text-slate-500">
                {[job.company, levelLabel(job.level)].filter(Boolean).join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/jobs"
        className="mt-4 inline-block text-sm font-semibold text-teal-800 hover:underline"
      >
        See what to build first →
      </Link>
    </>
  );
}

async function LikelyQuestions() {
  let jobs: TargetJob[];
  let stories: StoryRecord[];
  try {
    [jobs, stories] = await Promise.all([listJobs(), listStories()]);
  } catch (err) {
    unstable_rethrow(err);
    console.error("Home: loading likely questions failed", err);
    return <EmptyLine>Your questions couldn&apos;t be loaded right now.</EmptyLine>;
  }
  if (jobs.length === 0) return <EmptyLine>Questions appear once you add a target job.</EmptyLine>;
  const job = jobs.find((j) => j.likelyQuestions);
  if (!job?.likelyQuestions) {
    return (
      <>
        <EmptyLine>See the questions {jobs[0].title} is most likely to ask.</EmptyLine>
        <Link
          href={`/jobs/${jobs[0].id}`}
          className="mt-4 inline-block text-sm font-semibold text-teal-800 hover:underline"
        >
          Predict them →
        </Link>
      </>
    );
  }
  return (
    <>
      <p className="mb-3 text-sm text-slate-500">For {job.title}</p>
      <QuestionList questions={job.likelyQuestions.questions} stories={stories} limit={3} compact />
      <Link
        href={`/jobs/${job.id}`}
        className="mt-4 inline-block text-sm font-semibold text-teal-800 hover:underline"
      >
        All {job.likelyQuestions.questions.length} questions →
      </Link>
    </>
  );
}

async function PastInterviews() {
  let transcripts: Transcript[];
  try {
    transcripts = await listTranscripts();
  } catch (err) {
    unstable_rethrow(err);
    console.error("Home: loading transcripts failed", err);
    return <EmptyLine>Your past interviews couldn&apos;t be loaded right now.</EmptyLine>;
  }
  if (transcripts.length === 0) {
    return (
      <>
        <EmptyLine>
          Had an interview already? Upload the transcript and I&apos;ll show what they probed for
          and how your answers landed.
        </EmptyLine>
        <Link
          href="/transcripts"
          className="mt-4 inline-block text-sm font-semibold text-teal-800 hover:underline"
        >
          Add a transcript →
        </Link>
      </>
    );
  }
  const { recurringGaps } = summarizeTranscripts(transcripts);
  return (
    <>
      <p className="text-slate-700">
        {transcripts.length} past {transcripts.length === 1 ? "interview" : "interviews"} added.
      </p>
      {recurringGaps.length > 0 && (
        <p className="mt-2 text-sm text-slate-500">
          Your answers keep missing: {recurringGaps.slice(0, 3).map((g) => gapLabel(g.gap).toLowerCase()).join(", ")}.
        </p>
      )}
      <Link
        href="/transcripts"
        className="mt-4 inline-block text-sm font-semibold text-teal-800 hover:underline"
      >
        See what they looked for →
      </Link>
    </>
  );
}

function Card({
  title,
  className = "bg-white text-slate-900",
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-3xl p-6 shadow-sm ring-1 ring-black/5 ${className}`}>
      <h2 className="text-sm font-bold uppercase tracking-wide opacity-80">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-slate-500">{children}</p>;
}

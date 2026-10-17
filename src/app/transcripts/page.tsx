import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { PageGuide } from "@/components/page-guide";
import { StoryPlan } from "@/components/story-plan";
import { listJobs } from "@/lib/jobs/data";
import { getTheme } from "@/lib/questions/themes";
import { listStories } from "@/lib/stories/data";
import { MAX_TRANSCRIPTS, gapLabel, summarizeTranscripts } from "@/lib/transcripts/content";
import { listTranscripts } from "@/lib/transcripts/data";
import { leftOutNote } from "@/lib/transcripts/split";
import { AddTranscriptForm } from "./forms";

export const metadata: Metadata = { title: "Past interviews · InterviewMax" };

// Adding a transcript reviews it, which is a long model call.
export const maxDuration = 300;

export default function TranscriptsPage({ searchParams }: PageProps<"/transcripts">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/" className="text-sm font-medium text-ink-800 hover:underline">
          ← Back to your prep
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Your past interviews
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Upload transcripts of interviews you&apos;ve had. I&apos;ll find what each interviewer
          asked and probed for and how your answers landed, quoting the transcript for every point,
          and use it to sharpen your likely questions and your stories.
        </p>
        <PageGuide
          id="transcripts"
          steps={[
            "Upload or paste a transcript, and pick the target job it was for if there is one.",
            "I review it: each question asked, what they probed for, and how your answer landed.",
            "Build the stories under “Stories to work on”, then predict that job's questions again.",
          ]}
        />
        <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-3xl bg-white/80" />}>
          <TranscriptsContent searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function TranscriptsContent({
  searchParams,
}: {
  searchParams: PageProps<"/transcripts">["searchParams"];
}) {
  // From a job's page: "Add a transcript" opens the form with that job picked.
  const { job: jobParam, added, left } = await searchParams;
  const jobId = typeof jobParam === "string" ? jobParam : "";
  // After a file with several interviews in it was added (see addTranscript).
  const addedCount = typeof added === "string" ? Number.parseInt(added, 10) : 0;
  const leftNote = leftOutNote(typeof left === "string" ? left.split(",") : []);
  const [transcripts, jobs, stories] = await Promise.all([
    listTranscripts(),
    listJobs(),
    listStories(),
  ]);
  const insights = summarizeTranscripts(transcripts);
  const jobOptions = jobs.map((j) => ({ id: j.id, title: j.title, company: j.company }));

  if (transcripts.length === 0) {
    return (
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Add your first interview" className="lg:col-span-2">
          <AddTranscriptForm jobs={jobOptions} jobId={jobId} />
        </Card>
        <Card title="Where to find one">
          <ul className="list-disc space-y-2 pl-5 text-slate-700">
            <li>Zoom, Teams and Meet can save a transcript or captions file of a recorded call.</li>
            <li>Otter, Fathom, Granola and similar note-takers export a transcript.</li>
            <li>A mock interview with a friend or coach counts too.</li>
          </ul>
          <p className="mt-4 text-sm text-slate-500">
            Transcripts stay private to you. Only record an interview where everyone agreed to it.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {addedCount > 1 && (
          <p className="rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-900" data-testid="added-note">
            That file had {addedCount} interviews, so I saved and reviewed each one on its own.
            {leftNote && ` ${leftNote}`}
          </p>
        )}
        <ul className="space-y-3" data-testid="transcript-list">
          {transcripts.map((t) => {
            const job = jobs.find((j) => j.id === t.targetJobId);
            const weak = t.analysis?.asked.filter((q) => q.landed === "weak" || q.landed === "mixed");
            return (
              <li key={t.id}>
                <Link
                  href={`/transcripts/${t.id}`}
                  className="block rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition hover:ring-ink-700/40"
                >
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-lg font-bold text-slate-900">
                      {t.title}
                      {t.company && !t.title.includes(t.company) && (
                        <span className="font-normal text-slate-600"> at {t.company}</span>
                      )}
                    </span>
                    <span className="rounded-full bg-ink-50 px-2.5 py-1 text-xs font-semibold text-ink-900">
                      {t.analysis
                        ? `${t.analysis.asked.length} questions${weak?.length ? ` · ${weak.length} to work on` : ""}`
                        : "Not reviewed yet"}
                    </span>
                  </span>
                  {job && <span className="mt-1 block text-sm text-slate-500">For {job.title}</span>}
                  {t.analysis?.summary && (
                    <span className="mt-2 block text-slate-600">{t.analysis.summary}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {insights.storyFocus.length > 0 && (
          <Card title="Stories to work on">
            <p className="mb-4 text-sm text-slate-600">
              From the questions your interviewers asked most and the answers that didn&apos;t land.
            </p>
            <StoryPlan order={insights.storyFocus} stories={stories} />
          </Card>
        )}

        {transcripts.length < MAX_TRANSCRIPTS && (
          <details
            className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5"
            open={Boolean(jobId) || undefined}
          >
            <summary className="cursor-pointer text-sm font-bold uppercase tracking-wide text-ink-800">
              Add another interview
            </summary>
            <div className="mt-4">
              <AddTranscriptForm jobs={jobOptions} jobId={jobId} />
            </div>
          </details>
        )}
      </div>

      <div className="space-y-4">
        {insights.recurringGaps.length > 0 && (
          <Card title="Your answers keep missing">
            <ul className="space-y-2" data-testid="recurring-gaps">
              {insights.recurringGaps.map((g) => (
                <li key={g.gap} className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-slate-900">{gapLabel(g.gap)}</span>
                  <span className="text-sm text-slate-500">
                    {g.count} answers
                    {insights.analyzed > 1 &&
                      `, ${g.transcripts} ${g.transcripts === 1 ? "interview" : "interviews"}`}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-slate-500">
              The story builder&apos;s follow-ups now push on these.
            </p>
          </Card>
        )}
        {insights.lookingFor.length > 0 && (
          <Card title="What interviewers looked for">
            <Bullets items={insights.lookingFor.slice(0, 8)} />
          </Card>
        )}
        {insights.themes.length > 0 && (
          <Card title="What they asked about">
            <ul className="space-y-2">
              {insights.themes.map((t) => (
                <li key={t.theme} className="flex items-baseline justify-between gap-3">
                  <span className="text-slate-800">{getTheme(t.theme)?.label}</span>
                  <span className="text-sm text-slate-500">
                    {t.asked}×{t.weak > 0 && ` · ${t.weak} didn't land`}
                  </span>
                </li>
              ))}
            </ul>
            {jobs.length > 0 && (
              <p className="mt-4 text-sm text-slate-500">
                Predict your likely questions again on a{" "}
                <Link href="/jobs" className="font-semibold text-ink-800 underline">
                  target job
                </Link>{" "}
                to fold these in.
              </p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function Card({
  title,
  className = "bg-white",
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-3xl p-6 shadow-sm ring-1 ring-black/5 ${className}`}>
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-800">{title}</h2>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

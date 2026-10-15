import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { getJob } from "@/lib/jobs/data";
import { getTheme } from "@/lib/questions/themes";
import { gapLabel, type AskedQuestion, type Landed } from "@/lib/transcripts/content";
import { getTranscript } from "@/lib/transcripts/data";
import { removeTranscript } from "../actions";
import { PendingButton, ReviewAgainButton } from "../forms";

export const metadata: Metadata = { title: "Past interview · InterviewMax" };

// Reviewing a transcript is a long model call.
export const maxDuration = 300;

const LANDED_STYLES: Record<Landed, { label: string; className: string }> = {
  strong: { label: "Landed well", className: "bg-ink-800 text-white" },
  mixed: { label: "Partly landed", className: "bg-amber-100 text-amber-900" },
  weak: { label: "Didn't land", className: "bg-red-100 text-red-900" },
  unclear: { label: "Not judged", className: "bg-slate-100 text-slate-600" },
};

export default function TranscriptPage({ params }: PageProps<"/transcripts/[id]">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/transcripts" className="text-sm font-medium text-ink-800 hover:underline">
          ← All past interviews
        </Link>
        <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-3xl bg-white/80" />}>
          <TranscriptContent params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function TranscriptContent({ params }: { params: PageProps<"/transcripts/[id]">["params"] }) {
  const { id } = await params;
  const transcript = await getTranscript(id);
  if (!transcript) notFound();
  const job = transcript.targetJobId ? await getJob(transcript.targetJobId) : null;
  const analysis = transcript.analysis;

  return (
    <>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
        {transcript.title}
        {transcript.company && !transcript.title.includes(transcript.company) && (
          <span className="font-bold text-slate-500"> at {transcript.company}</span>
        )}
      </h1>
      {analysis?.summary && <p className="mt-2 max-w-2xl text-slate-600">{analysis.summary}</p>}
      {job && (
        <p className="mt-1 text-sm text-slate-500">
          For{" "}
          <Link href={`/jobs/${job.id}`} className="font-semibold text-ink-800 hover:underline">
            {job.title}
          </Link>
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {analysis ? (
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-800">
                What they asked, and how it landed
              </h2>
              <p className="mb-4 text-sm text-slate-600">
                In the order they asked. Every quote is from your transcript.
              </p>
              <ol className="space-y-3" data-testid="asked-list">
                {analysis.asked.map((q, i) => (
                  <AskedItem key={q.question} q={q} n={i + 1} />
                ))}
              </ol>
            </section>
          ) : (
            <section className="rounded-3xl bg-amber-50 p-6 ring-1 ring-black/5">
              <p className="mb-4 text-slate-700">
                I haven&apos;t reviewed this interview yet, or the last try didn&apos;t finish.
              </p>
              <ReviewAgainButton transcriptId={transcript.id} reviewed={false} />
            </section>
          )}
          <details className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <summary className="cursor-pointer text-sm font-bold uppercase tracking-wide text-ink-800">
              The transcript
            </summary>
            <p className="mt-4 whitespace-pre-line text-slate-700">{transcript.transcript}</p>
          </details>
        </div>

        <div className="space-y-4">
          {analysis && analysis.lookingFor.length > 0 && (
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-800">
                What this interviewer looked for
              </h2>
              <ul className="space-y-3" data-testid="looking-for">
                {analysis.lookingFor.map((l) => (
                  <li key={l.point}>
                    <p className="font-semibold text-slate-900">{l.point}</p>
                    <Quote>{l.quote}</Quote>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {analysis && (
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <p className="mb-4 text-sm text-slate-600">
                {analysis.dropped > 0
                  ? `I left out ${analysis.dropped} ${analysis.dropped === 1 ? "point" : "points"} I couldn't quote from the transcript.`
                  : "Every point here is quoted from the transcript."}
              </p>
              <ReviewAgainButton transcriptId={transcript.id} reviewed />
            </section>
          )}
          <form action={removeTranscript}>
            <input type="hidden" name="transcriptId" value={transcript.id} />
            <PendingButton
              pendingText="Removing…"
              className="text-sm font-medium text-slate-500 hover:text-red-700"
            >
              Remove this interview
            </PendingButton>
          </form>
        </div>
      </div>
    </>
  );
}

function AskedItem({ q, n }: { q: AskedQuestion; n: number }) {
  const landed = LANDED_STYLES[q.landed];
  return (
    <li className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-black/5">
      <p className="font-semibold text-slate-900">
        <span className="mr-2 text-ink-800">{n}.</span>
        {q.question}
      </p>
      <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
        <span className="rounded-full bg-ink-50 px-2 py-0.5 font-semibold text-ink-900">
          {getTheme(q.theme)?.label ?? "Other"}
        </span>
        <span className={`rounded-full px-2 py-0.5 font-semibold ${landed.className}`}>
          {landed.label}
        </span>
        {q.gaps.map((g) => (
          <span key={g} className="rounded-full bg-white px-2 py-0.5 font-semibold text-slate-700 ring-1 ring-slate-200">
            Missing: {gapLabel(g).toLowerCase()}
          </span>
        ))}
      </p>
      {q.note && <p className="mt-2 text-sm text-slate-700">{q.note}</p>}
      {q.evidence && <Quote label="You said">{q.evidence}</Quote>}
      {q.probes.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            They followed up with
          </p>
          <ul className="mt-1 space-y-1">
            {q.probes.map((p) => (
              <li key={p}>
                <Quote>{p}</Quote>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function Quote({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <blockquote className="mt-1 border-l-2 border-ink-700/30 pl-3 text-sm text-slate-600">
      {label && <span className="font-semibold text-slate-700">{label}: </span>}
      &ldquo;{children}&rdquo;
    </blockquote>
  );
}

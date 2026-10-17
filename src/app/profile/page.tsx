import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { startStory } from "@/app/stories/new/actions";
import { AppHeader } from "@/components/app-header";
import { getAssessmentSafely } from "@/lib/assessment/data";
import { listJobs } from "@/lib/jobs/data";
import { getNumbersChecklistSafely } from "@/lib/numbers/data";
import { listPracticeSessionsSafely } from "@/lib/practice/data";
import {
  READINESS_LABELS,
  STATUS_LABELS,
  assessProfile,
  type Citation,
  type CriterionResult,
  type NextStep,
  type Point,
  type ProfileResult,
  type ReadinessLabel,
  type Status,
} from "@/lib/profile/assess";
import {
  changesSince,
  factsBasis,
  recordVisit,
  snapshotOf,
  summaryFacts,
  type Change,
  type StoredProfile,
} from "@/lib/profile/content";
import { getStoredProfile, saveStoredProfile } from "@/lib/profile/data";
import { fallbackSummary } from "@/lib/profile/prompts";
import { writeProfileSummary } from "@/lib/profile/summary";
import { listStories } from "@/lib/stories/data";
import { listTranscriptsForPrep } from "@/lib/transcripts/data";
import { trackEvent } from "@/lib/usage/track";

export const metadata: Metadata = { title: "Your interviewee profile · InterviewMax" };

// The summary is a model call, streamed in after the rest of the page.
export const maxDuration = 60;

// The interviewee profile (PRD v0.3, P0): strengths, weaknesses and readiness per job, worked out
// in code from the user's stories, grades, numbers, past interviews, practice and journey check
// (src/lib/profile). Private to the user.
export default function ProfilePage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/" className="text-sm font-medium text-ink-800 hover:underline">
          ← Back to your prep
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Your interviewee profile
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          How you come across as a candidate right now, from your stories, grades, numbers, practice
          and past interviews. Every point links to what it&apos;s based on. Only you can see this
          page.
        </p>
        <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-3xl bg-white/80" />}>
          <ProfileContent />
        </Suspense>
      </main>
    </div>
  );
}

async function ProfileContent() {
  const [stories, jobs, numbers, transcripts, practice, assessment] = await Promise.all([
    listStories(),
    listJobs(),
    getNumbersChecklistSafely(),
    listTranscriptsForPrep(),
    listPracticeSessionsSafely(),
    getAssessmentSafely(),
  ]);
  const result = assessProfile({ stories, jobs, numbers, transcripts, practice, assessment });
  await trackEvent("profile_opened");

  // The stored part (summary and snapshots) is extra: without it the page still works.
  let stored: StoredProfile | null = null;
  let changes: Change[] = [];
  let since: string | undefined;
  try {
    const visit = recordVisit(await getStoredProfile(), snapshotOf(result, new Date().toISOString()));
    stored = visit.stored;
    if (visit.changed) await saveStoredProfile(stored);
    if (stored.previous && stored.latest) {
      changes = changesSince(stored.previous, stored.latest);
      since = stored.previous.at;
    }
  } catch (err) {
    unstable_rethrow(err);
    console.error("Profile: reading or saving the stored profile failed", err);
  }

  return (
    <div className="mt-8 space-y-6">
      <Card title="Overall">
        <Suspense fallback={<SummaryText text={fallbackSummary(result)} pending />}>
          <Summary result={result} stored={stored} />
        </Suspense>
        {result.jobs.length > 0 ? (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2" data-testid="profile-jobs">
            {result.jobs.map((job) => (
              <li key={job.jobId} className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-black/5">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/jobs/${job.jobId}`} className="min-w-0 font-semibold text-slate-900 hover:text-ink-800">
                    <span className="block truncate">{job.title}</span>
                    {job.company && <span className="block truncate text-sm font-normal text-slate-500">{job.company}</span>}
                  </Link>
                  <ReadinessPill label={job.label} />
                </div>
                <ul className="mt-2 space-y-0.5 text-sm text-slate-600">
                  {job.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            <Link href="/jobs/new" className="font-semibold text-ink-800 hover:underline">
              Add a target job
            </Link>{" "}
            to see how ready you are for it.
          </p>
        )}
      </Card>

      {changes.length > 0 && since && (
        <Card title={`Since ${formatDay(since)}`}>
          <ul className="space-y-1 text-sm" data-testid="profile-changes">
            {changes.map((c) => (
              <li key={c.text} className="flex items-start gap-2">
                <span
                  aria-hidden
                  className={c.direction === "down" ? "text-amber-600" : "text-green-600"}
                >
                  {c.direction === "down" ? "▼" : c.direction === "up" ? "▲" : "●"}
                </span>
                <span className="text-slate-700">{c.text}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Top strengths">
          <PointList points={result.strengths} empty="Strengths show up once a few stories are written and graded." testId="profile-strengths" />
        </Card>
        <Card title="Top weaknesses">
          <PointList points={result.weaknesses} empty="Nothing stands out yet." testId="profile-weaknesses" />
        </Card>
      </div>

      <Card title="What it's based on">
        <ul className="divide-y divide-slate-100" data-testid="profile-criteria">
          {result.criteria.map((c) => (
            <CriterionRow key={c.id} criterion={c} />
          ))}
        </ul>
      </Card>
    </div>
  );
}

// The model's summary when it's current; otherwise a new one is written and kept. Falls back to
// the summary written in code.
async function Summary({ result, stored }: { result: ProfileResult; stored: StoredProfile | null }) {
  if (result.empty) return <SummaryText text={fallbackSummary(result)} />;
  const basis = factsBasis(summaryFacts(result));
  if (stored?.summary?.basis === basis) return <SummaryText text={stored.summary.text} />;
  let text = stored?.summary?.text ?? fallbackSummary(result);
  try {
    const summary = await writeProfileSummary(result);
    if (summary) {
      text = summary.text;
      if (stored) await saveStoredProfile({ ...stored, summary });
    } else {
      text = fallbackSummary(result);
    }
  } catch (err) {
    unstable_rethrow(err);
    console.error("Profile: writing the summary failed", err);
  }
  return <SummaryText text={text} />;
}

function SummaryText({ text, pending = false }: { text: string; pending?: boolean }) {
  return (
    <p className={`max-w-3xl text-lg text-slate-800 ${pending ? "opacity-70" : ""}`} data-testid="profile-summary">
      {text}
    </p>
  );
}

function PointList({ points, empty, testId }: { points: Point[]; empty: string; testId: string }) {
  if (points.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-4" data-testid={testId}>
      {points.map((p) => (
        <li key={p.text}>
          <p className="font-semibold text-slate-900">{p.text}</p>
          <CitationLine citation={p.citation} />
          {p.next && <NextStepButton step={p.next} />}
        </li>
      ))}
    </ul>
  );
}

function CitationLine({ citation }: { citation: Citation }) {
  const label = citation.href ? (
    <Link href={citation.href} className="font-medium text-ink-800 hover:underline">
      {citation.label}
    </Link>
  ) : (
    <span className="font-medium text-slate-700">{citation.label}</span>
  );
  return (
    <p className="mt-1 text-sm text-slate-600">
      {label}
      {citation.quote && <span className="text-slate-500"> · “{citation.quote}”</span>}
    </p>
  );
}

function NextStepButton({ step }: { step: NextStep }) {
  const className =
    "mt-2 inline-flex rounded-xl bg-ink-800 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-ink-900";
  if (step.storyType) {
    return (
      <form action={startStory}>
        <button type="submit" name="storyType" value={step.storyType} className={className}>
          {step.label}
        </button>
      </form>
    );
  }
  return (
    <Link href={step.href ?? "/"} className={className}>
      {step.label}
    </Link>
  );
}

function CriterionRow({ criterion: c }: { criterion: CriterionResult }) {
  return (
    <li className="py-4 first:pt-0 last:pb-0" data-testid={`criterion-${c.id}`} data-status={c.status}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{c.label}</h3>
        <StatusPill status={c.status} />
      </div>
      <p className="mt-1 text-slate-700">{c.headline}</p>
      {c.details.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-600">
          {c.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
      {c.citations.map((citation) => (
        <CitationLine key={citation.label + (citation.quote ?? "")} citation={citation} />
      ))}
      {c.next && (
        <Link href={c.next.href ?? "/"} className="mt-1 inline-block text-sm font-semibold text-ink-800 hover:underline">
          {c.next.label} →
        </Link>
      )}
    </li>
  );
}

const STATUS_STYLE: Record<Status, string> = {
  strong: "bg-green-100 text-green-900",
  developing: "bg-ink-50 text-ink-900",
  weak: "bg-amber-100 text-amber-900",
  no_data: "bg-slate-100 text-slate-600",
};

function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

const READINESS_STYLE: Record<ReadinessLabel, string> = {
  ready: "bg-green-100 text-green-900",
  getting_there: "bg-ink-50 text-ink-900",
  not_ready: "bg-amber-100 text-amber-900",
};

function ReadinessPill({ label }: { label: ReadinessLabel }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${READINESS_STYLE[label]}`}>
      {READINESS_LABELS[label]}
    </span>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-6 text-slate-900 shadow-sm ring-1 ring-black/5">
      <h2 className="text-sm font-bold uppercase tracking-wide opacity-80">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

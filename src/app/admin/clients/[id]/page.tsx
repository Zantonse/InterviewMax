import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import {
  AdminSetupError,
  isUserId,
  listUserStories,
  logAdminView,
  requireAdmin,
} from "@/lib/admin/data";
import { roundLabel } from "@/lib/bank/content";
import { listGuidelines } from "@/lib/coaching/admin";
import { interviewLabel, nextInterview, storiesByLevel } from "@/lib/coaching/client-view";
import {
  CoachingSetupError,
  clientJobs,
  clientPractice,
  clientProfileInput,
  getActiveClient,
  type ClientJob,
  type ClientPractice,
} from "@/lib/coaching/clients";
import { guidelineBlocks, type Guideline } from "@/lib/coaching/guidelines";
import { levelLabel } from "@/lib/jobs/content";
import { outcomeLabel } from "@/lib/jobs/outcome";
import { CONFIDENCE_LABELS } from "@/lib/practice/content";
import { getStoryType } from "@/lib/stories/story-types";
import { buildInterviewProfile, type InterviewProfile } from "@/lib/transcripts/profile";
import { Card, SetupNeeded, formatDay, formatWhen } from "../../ui";

export const metadata: Metadata = {
  title: "Client · Admin · InterviewMax",
  robots: { index: false, follow: false },
};

// One coaching client (1:1 coaching, 2026-11-19): their jobs and interview dates, stories by level,
// practice and interview profile, with the coach's own checklists beside it. Open only while the
// client has coaching on; the view is logged. Never uploads.
export default function ClientPage({ params }: PageProps<"/admin/clients/[id]">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/admin/clients" className="text-sm font-medium text-ink-800 hover:underline">
          ← My clients
        </Link>
        <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-3xl bg-white/80" />}>
          <ClientContent params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function ClientContent({ params }: { params: PageProps<"/admin/clients/[id]">["params"] }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AdminSetupError) return <SetupNeeded message={err.message} />;
    throw err;
  }
  const { id } = await params;
  if (!isUserId(id)) notFound();
  let client;
  try {
    client = await getActiveClient(admin, id);
  } catch (err) {
    if (err instanceof CoachingSetupError) return <SetupNeeded message={err.message} />;
    throw err;
  }
  if (!client) notFound();
  await logAdminView(admin, "client", id);

  const [jobsByUser, stories, practice, profileInput, guidelines] = await Promise.all([
    clientJobs(admin, [id]),
    listUserStories(admin, id),
    clientPractice(admin, id),
    clientProfileInput(admin, id),
    listGuidelines(admin).catch(() => [] as Guideline[]),
  ]);
  const jobs = jobsByUser.get(id) ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const next = nextInterview(jobs, today);
  const groups = storiesByLevel(
    stories.map((s) => ({
      id: s.id,
      title: s.title,
      storyType: s.storyType,
      content: s.content,
      updatedAt: s.updatedAt,
    })),
  );
  const profile = buildInterviewProfile(profileInput);
  const checklists = guidelines.filter((g) =>
    guidelineBlocks(g.body).some((b) => b.kind === "checklist"),
  );

  return (
    <>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="break-words text-3xl font-extrabold tracking-tight text-slate-900">
          {client.label || client.email}
        </h1>
        {next && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">
            {interviewLabel(next, today)}
          </span>
        )}
      </div>
      <p className="mt-2 text-slate-600">
        {client.label && <span className="break-all">{client.email} · </span>}
        Coaching since {formatDay(client.startedAt)}
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card title="Jobs and interview dates">
            <JobList jobs={jobs} />
          </Card>

          <Card title="Stories by level" note="Opening a story is logged.">
            {groups.length === 0 ? (
              <p className="text-sm text-slate-600">No stories yet.</p>
            ) : (
              <div className="space-y-5" data-testid="client-stories">
                {groups.map((group) => (
                  <section key={group.id}>
                    <h3 className="text-base font-bold text-slate-900">
                      {group.title}{" "}
                      <span className="font-normal text-slate-500">({group.stories.length})</span>
                    </h3>
                    <p className="text-sm text-slate-500">{group.note}</p>
                    <ul className="mt-2 divide-y divide-slate-100 text-sm">
                      {group.stories.map((s) => (
                        <li key={s.id} className="flex flex-wrap items-baseline gap-x-3 py-2">
                          <Link
                            href={`/admin/users/${id}/stories/${s.id}`}
                            className="font-semibold text-ink-800 hover:underline"
                          >
                            {s.title}
                          </Link>
                          <span className="text-slate-500">
                            {[
                              getStoryType(s.storyType)?.label ?? s.storyType,
                              group.id === "other" && s.level ? `Level ${s.level}` : null,
                              `changed ${formatWhen(s.updatedAt)}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </Card>

          <Card title="Practice" note="The latest rounds: each question and how sure they felt after.">
            <PracticeList rounds={practice} jobs={jobs} />
          </Card>

          <Card
            title="Interview profile"
            note="From their past interviews' reviews. The transcripts themselves aren't shown."
          >
            <ProfileView profile={profile} />
          </Card>
        </div>

        <aside className="space-y-6" aria-label="Your checklists">
          {checklists.length === 0 ? (
            <Card title="Your checklists">
              <p className="text-sm text-slate-600">
                Add checklists in{" "}
                <Link href="/admin/guidelines" className="font-medium text-ink-800 hover:underline">
                  Coaching guidelines
                </Link>{" "}
                and they show here.
              </p>
            </Card>
          ) : (
            checklists.map((g) => (
              <Card key={g.id} title={g.title} note="Ticks aren't saved.">
                <ul className="space-y-2 text-sm text-slate-700">
                  {guidelineBlocks(g.body)
                    .flatMap((b) => (b.kind === "checklist" ? b.items : []))
                    .map((item, i) => (
                      <li key={i}>
                        <label className="flex cursor-pointer items-start gap-2">
                          <input type="checkbox" className="mt-0.5 size-4 accent-ink-800" />
                          <span>{item}</span>
                        </label>
                      </li>
                    ))}
                </ul>
              </Card>
            ))
          )}
        </aside>
      </div>
    </>
  );
}

function JobList({ jobs }: { jobs: ClientJob[] }) {
  if (jobs.length === 0) return <p className="text-sm text-slate-600">No target jobs yet.</p>;
  const open = jobs.filter((j) => !j.outcome);
  const finished = jobs.filter((j) => j.outcome);
  return (
    <div data-testid="client-jobs">
      {open.length === 0 ? (
        <p className="text-sm text-slate-600">No jobs in progress.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {open.map((job) => (
            <li key={job.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <span>
                <span className="font-semibold text-slate-900">{job.title}</span>
                {job.company && !job.title.includes(job.company) && (
                  <span className="text-slate-600"> at {job.company}</span>
                )}
                {levelLabel(job.level) && (
                  <span className="text-slate-500"> · {levelLabel(job.level)}</span>
                )}
              </span>
              <span className="text-slate-700">
                {job.interviewDate ? formatDay(`${job.interviewDate}T12:00:00Z`) : "No date set"}
                {job.nextStage && roundLabel(job.nextStage) && (
                  <span className="text-slate-500"> · {roundLabel(job.nextStage)}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {finished.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-medium text-slate-700">
            Finished jobs ({finished.length})
          </summary>
          <ul className="mt-2 space-y-1 text-slate-600">
            {finished.map((job) => (
              <li key={job.id}>
                {job.title}
                {job.company && !job.title.includes(job.company) && ` at ${job.company}`} ·{" "}
                {outcomeLabel(job.outcome) ?? "Finished"}
                {job.finishedOn && ` · ${formatDay(`${job.finishedOn}T12:00:00Z`)}`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function PracticeList({ rounds, jobs }: { rounds: ClientPractice[]; jobs: ClientJob[] }) {
  if (rounds.length === 0) return <p className="text-sm text-slate-600">No practice rounds yet.</p>;
  return (
    <ul className="space-y-4" data-testid="client-practice">
      {rounds.map((round) => {
        const job = jobs.find((j) => j.id === round.targetJobId);
        const answered = round.items.filter((item) => item.turns.length > 0 && !item.skipped);
        return (
          <li key={round.id} className="rounded-2xl p-4 ring-1 ring-slate-200">
            <p className="text-sm">
              <span className="font-semibold text-slate-900">{formatDay(round.createdAt)}</span>
              <span className="text-slate-500">
                {job ? ` · ${job.title}` : ""}
                {round.items.some((i) => i.screen) ? " · AI screen" : ""} · {answered.length} of{" "}
                {round.items.length} answered{round.finishedAt ? "" : " · not finished"}
              </span>
            </p>
            {answered.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {answered.map((item, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-x-3">
                    <span className="min-w-0">{item.question}</span>
                    <span className="shrink-0 text-slate-500">
                      {item.confidence ? CONFIDENCE_LABELS[item.confidence] : "No confidence tap"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ProfileView({ profile }: { profile: InterviewProfile }) {
  if (profile.interviews === 0) {
    return <p className="text-sm text-slate-600">No reviewed past interviews yet.</p>;
  }
  const lists = [
    { title: "Strengths", points: profile.strengths },
    { title: "Weak spots", points: profile.weaknesses },
  ];
  return (
    <div className="space-y-4 text-sm" data-testid="client-profile">
      <p className="text-slate-700">
        {profile.interviews} reviewed {profile.interviews === 1 ? "interview" : "interviews"},{" "}
        {profile.answers} answers judged
        {profile.landed !== null && `, ${profile.landed}% landed well`}.
      </p>
      {lists.map(({ title, points }) =>
        points.length === 0 ? null : (
          <div key={title}>
            <h3 className="font-bold text-slate-900">{title}</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">
              {points.map((p) => (
                <li key={p.id}>
                  <span className="font-medium text-slate-900">{p.title}.</span> {p.detail}
                </li>
              ))}
            </ul>
          </div>
        ),
      )}
      {profile.workOn.length > 0 && (
        <div>
          <h3 className="font-bold text-slate-900">Next to work on</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">
            {profile.workOn.map((w) => (
              <li key={w.id}>
                <span className="font-medium text-slate-900">{w.title}.</span> {w.why}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

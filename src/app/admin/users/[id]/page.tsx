import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import {
  AdminSetupError,
  isUserId,
  listUserProgress,
  listUserStories,
  logAdminView,
  requireAdmin,
  userTimeline,
} from "@/lib/admin/data";
import { hasDraft } from "@/lib/stories/content";
import { TIERS } from "@/lib/stories/grading";
import { getStoryType } from "@/lib/stories/story-types";
import { EVENT_LABELS } from "@/lib/usage/events";
import { Card, SetupNeeded, Stat, formatDay, formatWhen } from "../../ui";

export const metadata: Metadata = {
  title: "User activity · Admin · InterviewMax",
  robots: { index: false, follow: false },
};

// One user's progress, their stories (titles here; each opens read-only, for coaching) and a
// timeline of what they did and when.
export default function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/admin" className="text-sm font-medium text-ink-800 hover:underline">
          ← Back to admin
        </Link>
        <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-3xl bg-white/80" />}>
          <UserContent params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function UserContent({ params }: { params: PageProps<"/admin/users/[id]">["params"] }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AdminSetupError) return <SetupNeeded message={err.message} />;
    throw err;
  }
  const { id } = await params;
  if (!isUserId(id)) notFound();
  await logAdminView(admin, "user", id);
  const [users, timeline, stories] = await Promise.all([
    listUserProgress(admin),
    userTimeline(admin, id),
    listUserStories(admin, id),
  ]);
  const user = users.find((u) => u.id === id);
  if (!user) notFound();

  return (
    <>
      <h1 className="mt-3 break-words text-3xl font-extrabold tracking-tight text-slate-900">
        {user.email || "(no email)"}
      </h1>
      <p className="mt-2 text-slate-600">
        Signed up {formatDay(user.signedUpAt)} · last active {formatWhen(user.lastActiveAt)}
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Target jobs"
          value={String(user.jobs)}
          detail={`${user.jobsWithQuestions} with likely questions, ${user.interviewDates} with an interview date`}
        />
        <Stat
          label="Stories"
          value={`${user.storiesFinished} of ${user.storiesStarted}`}
          detail={`finished; ${user.storiesGraded} graded`}
        />
        <Stat label="About me" value={user.aboutMeDone ? "Done" : "Not yet"} />
        <Stat
          label="Other steps"
          value={String(
            [user.assessmentDone, user.finderUsed, user.transcripts > 0].filter(Boolean).length,
          )}
          detail={[
            user.assessmentDone ? "journey check done" : "no journey check",
            user.finderUsed ? "story finder used" : "story finder not used",
            `${user.transcripts} past interviews`,
          ].join(", ")}
        />
      </div>

      <div className="mt-6">
        <Card title="Stories" note="Opening a story is logged.">
          {stories.length === 0 ? (
            <p className="text-sm text-slate-600">No stories yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm" data-testid="admin-stories">
              {stories.map((s) => {
                const tier = s.content.grade && TIERS.find((t) => t.id === s.content.grade?.tier);
                return (
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
                        hasDraft(s.content) ? "written" : "in progress",
                        tier ? tier.label : null,
                        `changed ${formatWhen(s.updatedAt)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Timeline" note="Newest first. Estimated times come from before tracking started.">
          {timeline.length === 0 ? (
            <p className="text-sm text-slate-600">No activity recorded yet.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {timeline.map((entry, i) => (
                <li key={i} className="flex flex-wrap gap-x-3">
                  <span className="w-36 shrink-0 tabular-nums text-slate-500">
                    {formatWhen(entry.at)}
                  </span>
                  <span className="text-slate-800">{EVENT_LABELS[entry.event]}</span>
                  {entry.estimated && <span className="text-slate-400">(time estimated)</span>}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}

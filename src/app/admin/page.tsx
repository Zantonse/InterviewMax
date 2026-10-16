import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import {
  AdminSetupError,
  listEventFirsts,
  listUserProgress,
  logAdminView,
  recentAdminViews,
  requireAdmin,
} from "@/lib/admin/data";
import {
  formatDuration,
  funnel,
  percent,
  storiesPerUser,
  timeToValue,
  type TimeToValue,
  type UserProgress,
} from "@/lib/admin/metrics";
import { EVENT_LABELS } from "@/lib/usage/events";
import { Card, SetupNeeded, Stat, formatDay, formatWhen } from "./ui";

export const metadata: Metadata = {
  title: "Admin · InterviewMax",
  robots: { index: false, follow: false },
};

// Craig's admin panel (PRD v0.3): every user with their progress, the funnel and both
// time-to-value numbers. Activity only here; a user's stories open from their own page.
export default function AdminPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Admin</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Who is using InterviewMax and how far they get. Open a user to read their stories for
          coaching; uploads are never shown. Every visit and every story opened is logged.
        </p>
        <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-3xl bg-white/80" />}>
          <AdminContent />
        </Suspense>
      </main>
    </div>
  );
}

async function AdminContent() {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AdminSetupError) return <SetupNeeded message={err.message} />;
    throw err;
  }
  await logAdminView(admin, "overview");
  const [users, firsts, views] = await Promise.all([
    listUserProgress(admin),
    listEventFirsts(admin),
    recentAdminViews(admin),
  ]);

  const steps = funnel(users, firsts);
  const toQuestions = timeToValue(users, firsts, "likely_questions_shown");
  const toStory = timeToValue(users, firsts, "story_finished");
  const perUser = storiesPerUser(users);
  const anyEstimated = firsts.some((f) => f.estimated);

  return (
    <div className="mt-8 space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Users" value={String(users.length)} />
        <TimeStat label="Sign-up to first likely questions" result={toQuestions} />
        <TimeStat label="Sign-up to first finished story" result={toStory} />
        <Stat
          label="Stories per user"
          value={perUser.started.toFixed(1)}
          detail={`started; ${perUser.finished.toFixed(1)} finished`}
        />
      </div>

      <Card
        title="Funnel"
        note={
          anyEstimated
            ? "Includes activity from before tracking started, with times estimated from when it was saved."
            : undefined
        }
      >
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={step.event} className="grid grid-cols-[minmax(0,12rem)_1fr_auto] items-center gap-3">
              <span className="text-sm font-medium text-slate-800">{EVENT_LABELS[step.event]}</span>
              <span className="h-3 overflow-hidden rounded-full bg-ink-50">
                <span
                  className="block h-full rounded-full bg-ink-700"
                  style={{ width: `${Math.round(step.ofAll * 100)}%` }}
                />
              </span>
              <span className="text-right text-sm tabular-nums text-slate-700">
                {step.users}
                <span className="ml-2 text-slate-500">
                  {i === 0 ? "" : `${percent(step.ofPrevious)} of step before`}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="Users" note="Select a user to see their timeline.">
        <UsersTable users={users} />
      </Card>

      <Card
        title="Review queue"
        note="Items people choose to share for others will wait here for you to approve, edit or reject."
      >
        <ul className="divide-y divide-slate-100 text-sm">
          {[
            "Shared question bank",
            "Consented example answers",
            "Success stories",
          ].map((source) => (
            <li key={source} className="flex items-center justify-between py-2.5">
              <span className="font-medium text-slate-800">{source}</span>
              <span className="text-slate-500">Not built yet, nothing to review</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Admin view log" note="The latest visits to the admin pages, this one included.">
        <ul className="space-y-1 text-sm text-slate-700">
          {views.map((v, i) => (
            <li key={i}>
              {formatWhen(v.at)} · {v.adminEmail} ·{" "}
              {v.view === "user" && v.subjectUserId
                ? `user ${userLabel(users, v.subjectUserId)}`
                : "overview"}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function TimeStat({ label, result }: { label: string; result: TimeToValue }) {
  return (
    <Stat
      label={label}
      value={result.medianMs === null ? "–" : formatDuration(result.medianMs)}
      detail={`median, ${result.reached} of ${result.total} users got there${result.estimated ? " (some times estimated)" : ""}`}
    />
  );
}

function UsersTable({ users }: { users: UserProgress[] }) {
  if (users.length === 0) return <p className="text-sm text-slate-600">No users yet.</p>;
  return (
    <div className="-mx-6 overflow-x-auto px-6">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr className="border-b border-slate-200">
            <th className="py-2 pr-4 font-semibold">Email</th>
            <th className="py-2 pr-4 font-semibold">Signed up</th>
            <th className="py-2 pr-4 font-semibold">Last active</th>
            <th className="py-2 pr-4 font-semibold">Jobs</th>
            <th className="py-2 pr-4 font-semibold">Stories started</th>
            <th className="py-2 pr-4 font-semibold">Finished</th>
            <th className="py-2 pr-4 font-semibold">About me</th>
            <th className="py-2 pr-4 font-semibold">Practice</th>
            <th className="py-2 font-semibold">Brief</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-800">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-ink-50/60">
              <td className="py-2.5 pr-4">
                <Link href={`/admin/users/${u.id}`} className="font-medium text-ink-800 hover:underline">
                  {u.email || "(no email)"}
                </Link>
              </td>
              <td className="py-2.5 pr-4 whitespace-nowrap">{formatDay(u.signedUpAt)}</td>
              <td className="py-2.5 pr-4 whitespace-nowrap">{formatWhen(u.lastActiveAt)}</td>
              <td className="py-2.5 pr-4 tabular-nums">
                {u.jobs}
                {u.jobs > 0 && (
                  <span className="text-slate-500"> ({u.jobsWithQuestions} with questions)</span>
                )}
              </td>
              <td className="py-2.5 pr-4 tabular-nums">{u.storiesStarted}</td>
              <td className="py-2.5 pr-4 tabular-nums">{u.storiesFinished}</td>
              <td className="py-2.5 pr-4">{u.aboutMeDone ? "Done" : "–"}</td>
              <td className="py-2.5 pr-4 text-slate-400" title="Practice mode isn't built yet">
                n/a
              </td>
              <td className="py-2.5 text-slate-400" title="The pre-interview brief isn't built yet">
                n/a
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function userLabel(users: UserProgress[], id: string): string {
  return users.find((u) => u.id === id)?.email || "(deleted)";
}

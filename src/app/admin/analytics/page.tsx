import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { parseRange, rangeStart } from "@/lib/admin/analytics";
import {
  AdminSetupError,
  listEventFirsts,
  listEventsSince,
  listSignalsSince,
  listUserProgress,
  logAdminView,
  requireAdmin,
} from "@/lib/admin/data";
import { AdminTabs, SetupNeeded } from "../ui";
import { AnalyticsView } from "./view";

export const metadata: Metadata = {
  title: "Analytics · Admin · InterviewMax",
  robots: { index: false, follow: false },
};

// Usage over time: active users, sign-ups, stories, how far new people get and where they hit
// trouble. Built from the same activity-only events and click signals as the rest of the panel.
export default function AdminAnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Admin</h1>
        <AdminTabs current="analytics" />
        <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-3xl bg-white/80" />}>
          <AnalyticsContent searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function AnalyticsContent({
  searchParams,
}: {
  searchParams: PageProps<"/admin/analytics">["searchParams"];
}) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AdminSetupError) return <SetupNeeded message={err.message} />;
    throw err;
  }
  await logAdminView(admin, "analytics");
  const params = await searchParams;
  const range = parseRange(params.range);
  const withAdmins = params.admins === "1";
  const now = new Date();
  const start = rangeStart(range, now);

  const [allUsers, allFirsts, eventsResult, signalsResult] = await Promise.all([
    listUserProgress(admin),
    listEventFirsts(admin),
    listEventsSince(admin, start),
    listSignalsSince(admin, start),
  ]);

  return (
    <AnalyticsView
      range={range}
      withAdmins={withAdmins}
      now={now}
      allUsers={allUsers}
      allFirsts={allFirsts}
      events={eventsResult}
      signals={signalsResult}
    />
  );
}

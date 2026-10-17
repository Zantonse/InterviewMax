import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { AdminSetupError, logAdminView, requireAdmin } from "@/lib/admin/data";
import { listPendingQuestions, sharedQuestionCounts } from "@/lib/bank/admin";
import { roundLabel } from "@/lib/bank/content";
import { levelLabel } from "@/lib/jobs/content";
import { getTheme } from "@/lib/questions/themes";
import { AdminTabs, Card, SetupNeeded, Stat, formatDay } from "../ui";
import { ReviewItem } from "./review-item";

export const metadata: Metadata = {
  title: "Review queue · Admin · InterviewMax",
  robots: { index: false, follow: false },
};

// The review queue (PRD v0.3): questions people shared from their past interviews wait here for
// Craig to approve, edit or reject before anyone else sees them. Shows each question and its tags,
// never who shared it.
export default function ReviewPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Admin</h1>
        <AdminTabs current="review" />
        <p className="mt-4 max-w-2xl text-slate-600">
          Questions people chose to share from their past interviews. Names are removed in code
          first; check what&apos;s flagged, edit if needed, then approve or reject. Approved
          questions show as &ldquo;asked recently&rdquo; to other people with a job at that company.
        </p>
        <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-3xl bg-white/80" />}>
          <ReviewContent />
        </Suspense>
      </main>
    </div>
  );
}

async function ReviewContent() {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AdminSetupError) return <SetupNeeded message={err.message} />;
    throw err;
  }
  await logAdminView(admin, "review");
  const [pending, counts] = await Promise.all([listPendingQuestions(admin), sharedQuestionCounts(admin)]);
  return (
    <div className="mt-8 space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Waiting for review" value={String(counts.pending)} />
        <Stat label="Approved" value={String(counts.approved)} />
        <Stat label="Rejected" value={String(counts.rejected)} />
      </div>
      <Card title="Shared question bank">
        {pending.length === 0 ? (
          <p className="text-sm text-slate-600">Nothing waiting. New shared questions land here.</p>
        ) : (
          <ul className="divide-y divide-slate-100" data-testid="review-queue">
            {pending.map((q) => (
              <li key={q.id} className="py-4 first:pt-0 last:pb-0">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {[
                    q.company,
                    q.role,
                    levelLabel(q.level),
                    roundLabel(q.round),
                    getTheme(q.theme)?.label,
                    formatDay(q.askedMonth).replace(/ \d+,/, ""),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <ReviewItem id={q.id} question={q.question} flags={q.flags} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Not built yet">
        <ul className="divide-y divide-slate-100 text-sm">
          {["Consented example answers", "Success stories"].map((source) => (
            <li key={source} className="flex items-center justify-between py-2.5">
              <span className="font-medium text-slate-800">{source}</span>
              <span className="text-slate-500">Nothing to review</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

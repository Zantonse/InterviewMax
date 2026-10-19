import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { AdminSetupError, logAdminView, requireAdmin } from "@/lib/admin/data";
import { listGuidelines } from "@/lib/coaching/admin";
import { AdminTabs, SetupNeeded, formatWhen } from "../ui";
import { GuidelineSection, NewGuideline } from "./guideline-section";

export const metadata: Metadata = {
  title: "Coaching guidelines · Admin · InterviewMax",
  robots: { index: false, follow: false },
};

// Coaching guidelines: Craig's own principles and checklists for coaching people through their
// interview prep, editable in place. Admins only; users never see this page. The first piece of
// the coaching panel (PRD v0.3, P2), which can later pull a checklist from here into a call.
export default function GuidelinesPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Admin</h1>
        <AdminTabs current="guidelines" />
        <p className="mt-4 max-w-2xl text-slate-600">
          How you coach: your principles and the checklists you run before, during and after a
          session. Only admins can see this page. Edit any section in place.
        </p>
        <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-3xl bg-white/80" />}>
          <GuidelinesContent />
        </Suspense>
      </main>
    </div>
  );
}

async function GuidelinesContent() {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AdminSetupError) return <SetupNeeded message={err.message} />;
    throw err;
  }
  await logAdminView(admin, "guidelines");
  const guidelines = await listGuidelines(admin);
  const lastEdit = guidelines.reduce<(typeof guidelines)[number] | undefined>(
    (latest, g) => (!latest || g.updatedAt > latest.updatedAt ? g : latest),
    undefined,
  );
  return (
    <div className="mt-8 max-w-3xl space-y-6" data-testid="coaching-guidelines">
      {guidelines.length === 0 && (
        <p className="text-sm text-slate-600">No sections yet. Add your first one below.</p>
      )}
      {guidelines.map((g) => (
        <GuidelineSection key={`${g.id}:${g.updatedAt}`} guideline={g} />
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <NewGuideline />
        {lastEdit && (
          <p className="text-xs text-slate-500">
            Last edited {formatWhen(lastEdit.updatedAt)}
            {lastEdit.updatedBy ? ` by ${lastEdit.updatedBy}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

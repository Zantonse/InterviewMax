import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { PolicyLinks } from "@/components/policy-links";
import { getCurrentUser } from "@/lib/auth";
import { getCoachingStyleSafely } from "@/lib/coaching/data";
import { getExecModeSafely } from "@/lib/exec/settings";
import { getUserFieldSafely } from "@/lib/field/data";
import { listJobs } from "@/lib/jobs/data";
import { listStories } from "@/lib/stories/data";
import { listTranscripts } from "@/lib/transcripts/data";
import { CoachingStyleForm } from "./coaching-style-form";
import { DeleteAccountForm } from "./delete-account-form";
import { ExecModeForm } from "./exec-mode-form";
import { FieldForm } from "./field-form";

export const metadata: Metadata = { title: "Settings · InterviewMax" };

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/" className="text-sm font-medium text-ink-800 hover:underline">
          ← Back to your prep
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Settings
        </h1>

        <section
          id="field"
          className="mt-8 scroll-mt-20 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
          aria-labelledby="field-heading"
        >
          <h2 id="field-heading" className="text-xl font-bold text-slate-900">
            Your field
          </h2>
          <p className="mt-2 text-slate-600">
            The kind of work you do. The story builder&apos;s examples and memory joggers come from
            your field, Numbers and Map my role start on it, and the coach words its questions for
            it. Your facts and grades don&apos;t change.
          </p>
          <Suspense fallback={<p className="mt-4 h-16 animate-pulse rounded-xl bg-slate-100" />}>
            <FieldSection />
          </Suspense>
        </section>

        <section
          className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
          aria-labelledby="coaching-style-heading"
        >
          <h2 id="coaching-style-heading" className="text-xl font-bold text-slate-900">
            Coaching style
          </h2>
          <p className="mt-2 text-slate-600">
            How the coach talks to you in follow-up questions, practice feedback and your profile.
            It changes the tone only: the same gaps get flagged and grades don&apos;t move.
          </p>
          <Suspense fallback={<p className="mt-4 h-24 animate-pulse rounded-xl bg-slate-100" />}>
            <CoachingStyleSection />
          </Suspense>
        </section>

        <section
          id="exec-mode"
          className="mt-6 scroll-mt-20 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
          aria-labelledby="exec-mode-heading"
        >
          <h2 id="exec-mode-heading" className="text-xl font-bold text-slate-900">
            Exec mode
          </h2>
          <p className="mt-2 text-slate-600">
            For interviews with executives, or if you&apos;re working on how you talk to them. Off
            unless you turn it on.
          </p>
          <Suspense fallback={<p className="mt-4 h-16 animate-pulse rounded-xl bg-slate-100" />}>
            <ExecModeSection />
          </Suspense>
        </section>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Your data</h2>
          <p className="mt-2 text-slate-600">
            What you add stays private to you. Parts of it go to AI models to build and grade your
            stories, only through providers that don&apos;t train on it. Nothing is sold or used
            for ads.
          </p>
          <PolicyLinks className="mt-3" />
        </section>

        <section
          className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-red-200"
          aria-labelledby="delete-heading"
        >
          <h2 id="delete-heading" className="text-xl font-bold text-slate-900">
            Delete your account
          </h2>
          <Suspense fallback={<p className="mt-2 h-12 animate-pulse rounded-xl bg-slate-100" />}>
            <WhatGetsDeleted />
          </Suspense>
          <DeleteAccountForm />
        </section>
      </main>
    </div>
  );
}

async function CoachingStyleSection() {
  return <CoachingStyleForm initial={await getCoachingStyleSafely()} />;
}

async function ExecModeSection() {
  return <ExecModeForm initial={await getExecModeSafely()} />;
}

async function FieldSection() {
  return <FieldForm initial={await getUserFieldSafely()} />;
}

async function WhatGetsDeleted() {
  const user = await getCurrentUser();
  let counts: string | null = null;
  try {
    const [stories, jobs, transcripts] = await Promise.all([
      listStories(),
      listJobs(),
      listTranscripts(),
    ]);
    counts = [
      plural(stories.length, "story", "stories"),
      plural(jobs.length, "target job", "target jobs"),
      plural(transcripts.length, "past interview", "past interviews"),
    ].join(", ");
  } catch (error) {
    unstable_rethrow(error);
  }
  return (
    <p className="mt-2 text-slate-600" data-testid="delete-summary">
      This deletes {user.email ? <strong>{user.email}</strong> : "your account"} and everything
      in it{counts ? ` (${counts})` : ""}, plus your resume, numbers, role map and activity
      record. You&apos;ll be signed out, and it can&apos;t be undone.
    </p>
  );
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

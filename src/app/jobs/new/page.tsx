import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { MAX_JOBS } from "@/lib/jobs/content";
import { listJobs } from "@/lib/jobs/data";
import { AddJobForm } from "../forms";

export const metadata: Metadata = { title: "Add a target job · InterviewMax" };

// Adding a job reads all the jobs again and predicts its questions: two model calls.
export const maxDuration = 120;

export default function NewJobPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/jobs" className="text-sm font-medium text-navy-800 hover:underline">
          ← Your target jobs
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Add a target job
        </h1>
        <p className="mt-2 text-slate-600">
          Give me the posting any way you have it: a link, a file or the text. I&apos;ll show you
          the questions they&apos;re most likely to ask.
        </p>
        <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-slate-100" />}>
            <NewJob />
          </Suspense>
        </section>
      </main>
    </div>
  );
}

async function NewJob() {
  const jobs = await listJobs();
  if (jobs.length >= MAX_JOBS) {
    return (
      <p className="text-slate-700">
        You already have {MAX_JOBS} target jobs, the most you can keep.{" "}
        <Link href="/jobs" className="font-semibold text-navy-800 hover:underline">
          Remove one
        </Link>{" "}
        to add another.
      </p>
    );
  }
  return <AddJobForm />;
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { MAX_JOBS } from "@/lib/jobs/content";
import { listJobs } from "@/lib/jobs/data";
import { openJobs } from "@/lib/jobs/outcome";
import { MAX_OTHER_ROLES } from "@/lib/jobs/roles";
import { AddJobForm } from "../forms";

export const metadata: Metadata = { title: "Add a target job · InterviewMax" };

// Adding a job reads all the jobs again and predicts its questions: two model calls.
export const maxDuration = 120;

export default function NewJobPage({ searchParams }: PageProps<"/jobs/new">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/jobs" className="text-sm font-medium text-ink-800 hover:underline">
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
            <NewJob searchParams={searchParams} />
          </Suspense>
        </section>
      </main>
    </div>
  );
}

async function NewJob({ searchParams }: { searchParams: PageProps<"/jobs/new">["searchParams"] }) {
  const [jobs, { to }] = await Promise.all([listJobs(), searchParams]);
  const open = openJobs(jobs);
  // ?to=<job id>: adding another role at the same company to that job. It takes no job slot.
  const attachTo = open.find((j) => j.id === to && j.otherRoles.length < MAX_OTHER_ROLES);
  if (attachTo) {
    return (
      <AddJobForm
        attachTo={{ id: attachTo.id, title: attachTo.title, company: attachTo.company ?? "" }}
      />
    );
  }
  if (open.length >= MAX_JOBS) {
    return (
      <p className="text-slate-700">
        You already have {MAX_JOBS} target jobs in progress, the most you can keep.{" "}
        <Link href="/jobs" className="font-semibold text-ink-800 hover:underline">
          Open a job
        </Link>{" "}
        whose interviews are over and mark it finished, or remove one, to add another. Finished
        jobs don&apos;t count. Another role at a company you already have doesn&apos;t need a slot:
        use Add a role on that job&apos;s page.
      </p>
    );
  }
  return (
    <AddJobForm
      jobs={open
        .filter((j) => j.company && j.otherRoles.length < MAX_OTHER_ROLES)
        .map((j) => ({ id: j.id, title: j.title, company: j.company ?? "" }))}
    />
  );
}

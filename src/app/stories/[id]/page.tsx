import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { DeleteStoryButton } from "@/components/delete-story-button";
import { getJobsPrep, listJobs, type TargetJob } from "@/lib/jobs/data";
import type { StoryContent } from "@/lib/stories/content";
import { getStory } from "@/lib/stories/data";
import { REQUIRED_STORY_TYPE_ID } from "@/lib/stories/story-types";
import { StoryBuilder } from "./story-builder";

export const metadata: Metadata = { title: "Story builder · InterviewMax" };

// The builder's model calls run as Server Actions on this page; writing a story can take a while.
export const maxDuration = 120;

export default function StoryPage({ params }: PageProps<"/stories/[id]">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 xl:max-w-[96rem] px-4 py-6 sm:px-6 sm:py-10">
        <Link href="/" className="text-sm font-medium text-teal-800 hover:underline">
          ← Back to your prep
        </Link>
        <Suspense fallback={<BuilderSkeleton />}>
          <StoryLoader params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function StoryLoader({ params }: { params: PageProps<"/stories/[id]">["params"] }) {
  const { id } = await params;
  const story = await getStory(id);
  if (!story) notFound();
  const intro = story.storyType === REQUIRED_STORY_TYPE_ID;
  // Background for "Tell me about yourself": the resume and target jobs. Optional, so a failure to
  // load them never blocks the builder.
  const [resume, jobs] = intro
    ? await Promise.all([
        getJobsPrep().then(
          (p) => Boolean(p.resume),
          () => false,
        ),
        listJobs().catch(() => [] as TargetJob[]),
      ])
    : [false, [] as TargetJob[]];
  return (
    <>
      <StoryBuilder
        storyId={story.id}
        storyTypeId={story.storyType}
        initialTitle={story.title}
        initialContent={story.content}
        hasResume={resume}
      />
      {intro && <TailorLinks jobs={jobs} content={story.content} />}
      <DeleteStoryButton
        storyId={story.id}
        title={story.title}
        required={story.storyType === REQUIRED_STORY_TYPE_ID}
      />
    </>
  );
}

// "Tell me about yourself" is built per target job, company first; each job's version lives on its
// job page.
function TailorLinks({ jobs, content }: { jobs: TargetJob[]; content: StoryContent }) {
  return (
    <section
      className="mt-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6"
      data-testid="tailor-links"
    >
      <h2 className="text-sm font-bold uppercase tracking-wide text-teal-800">
        Make it company-first for each job
      </h2>
      <p className="mt-2 text-slate-600">
        This is your general answer. For a real interview, start from the company: say why you want
        to work there, and I&apos;ll rebuild it around the one proof point that job most needs to
        hear, in under 90 seconds.
      </p>
      {jobs.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">
          <Link href="/jobs" className="font-semibold text-teal-800 underline">
            Add a target job
          </Link>{" "}
          to get started.
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link
                href={`/jobs/${job.id}#about-me`}
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-teal-800 ring-1 ring-teal-800/20 hover:bg-teal-50"
              >
                {job.company || job.title}
                {content.tailored?.[job.id]?.draft && (
                  <span className="text-xs text-slate-500">written</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BuilderSkeleton() {
  return (
    <div className="mt-4 grid animate-pulse grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,26rem)]">
      <div className="h-96 rounded-3xl bg-white/80 ring-1 ring-black/5" />
      <div className="h-96 rounded-3xl bg-white/80 ring-1 ring-black/5" />
      <div className="hidden h-96 rounded-3xl bg-white/80 ring-1 ring-black/5 xl:block" />
    </div>
  );
}

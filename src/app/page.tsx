import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { builderStage } from "@/lib/stories/content";
import { listStories, type StoryRecord } from "@/lib/stories/data";
import { getStoryType } from "@/lib/stories/story-types";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Your interview prep
            </h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              Build one story at a time. Each one is drawn from your own answers, with your own
              numbers.
            </p>
          </div>
          <Link
            href="/stories/new"
            className="rounded-xl bg-teal-800 px-4 py-3 font-semibold text-white transition hover:bg-teal-900"
          >
            Build a story
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-2">
          <Card className="bg-teal-800 text-white md:col-span-2 md:row-span-2" title="Story bank">
            <Suspense fallback={<p className="text-5xl font-extrabold opacity-50">…</p>}>
              <StoryBank />
            </Suspense>
          </Card>
          <Card title="Target jobs">
            <EmptyLine>No target jobs added yet.</EmptyLine>
          </Card>
          <Card title="Likely questions">
            <EmptyLine>Questions appear once you add a target job.</EmptyLine>
          </Card>
        </div>
      </main>
    </div>
  );
}

async function StoryBank() {
  let stories: StoryRecord[];
  try {
    stories = await listStories();
  } catch (err) {
    // A signed-out redirect must still go through.
    unstable_rethrow(err);
    // Don't take the whole home page down if the database can't be read.
    console.error("Home: loading stories failed", err);
    return (
      <p className="max-w-md text-teal-50" role="alert" data-testid="story-bank-error">
        Your stories couldn&apos;t be loaded right now. Try again in a minute.
      </p>
    );
  }
  return (
    <>
      <p className="text-5xl font-extrabold" data-testid="story-count">
        {stories.length}
      </p>
      <p className="mt-1 text-teal-100">{stories.length === 1 ? "story" : "stories"} so far</p>
      {stories.length === 0 ? (
        <p className="mt-6 max-w-md text-teal-50">
          Every story you build is kept here. Start with a major project or customer: it&apos;s the
          one most interviews ask for.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-white/15 rounded-2xl bg-white/10">
          {stories.map((story) => {
            const drafted = builderStage(story.content) === "drafted";
            return (
              <li key={story.id}>
                <Link
                  href={`/stories/${story.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-white/10"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{story.title}</span>
                    <span className="block truncate text-sm text-teal-100">
                      {getStoryType(story.storyType)?.label ?? "Story"}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      drafted ? "bg-white text-teal-900" : "bg-teal-900/60 text-teal-50"
                    }`}
                  >
                    {drafted ? "Draft written" : "In progress"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Card({
  title,
  className = "bg-white text-slate-900",
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-3xl p-6 shadow-sm ring-1 ring-black/5 ${className}`}>
      <h2 className="text-sm font-bold uppercase tracking-wide opacity-80">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-slate-500">{children}</p>;
}

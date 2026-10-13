import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { getJobsPrep, listJobs } from "@/lib/jobs/data";
import { builderStage } from "@/lib/stories/content";
import { listStories } from "@/lib/stories/data";
import { REQUIRED_STORY_TYPE_ID, getStoryType } from "@/lib/stories/story-types";

// How many of the stories the user's jobs need most count toward the last step.
const PLAN_SIZE = 4;

type PathStep = { label: string; detail: string; href: string; done: boolean };

// Where the user is on the prep path (PRD: "Always show position"), shown on the home page.
export async function PrepPath() {
  let steps: PathStep[];
  try {
    steps = await pathSteps();
  } catch (err) {
    unstable_rethrow(err);
    console.error("Home: loading the prep path failed", err);
    return null;
  }
  const current = steps.findIndex((s) => !s.done);
  return (
    <nav aria-label="Your prep path" className="mt-8" data-testid="prep-path">
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.label}>
            <Link
              href={step.href}
              aria-current={i === current ? "step" : undefined}
              className={`flex h-full items-start gap-3 rounded-2xl p-4 ring-1 transition ${
                i === current
                  ? "bg-white shadow-sm ring-teal-700/50"
                  : "bg-white/60 ring-black/5 hover:bg-white"
              }`}
            >
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  step.done ? "bg-teal-800 text-white" : "bg-teal-50 text-teal-900"
                }`}
              >
                {step.done ? "✓" : i + 1}
              </span>
              <span>
                <span className="block font-semibold text-slate-900">{step.label}</span>
                <span className="block text-sm text-slate-600">{step.detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

async function pathSteps(): Promise<PathStep[]> {
  const [jobs, { overview }, stories] = await Promise.all([
    listJobs(),
    getJobsPrep(),
    listStories(),
  ]);
  const drafted = new Set(
    stories
      .filter((s) => builderStage(s.content, getStoryType(s.storyType)) === "drafted")
      .map((s) => s.storyType),
  );
  const aboutMe = stories.find((s) => s.storyType === REQUIRED_STORY_TYPE_ID);
  const plan = (overview?.storyOrder ?? [])
    .map((p) => p.storyType)
    .filter((t) => t !== REQUIRED_STORY_TYPE_ID)
    .slice(0, PLAN_SIZE);
  const planDone = plan.filter((t) => drafted.has(t)).length;

  return [
    {
      label: "Add your target jobs",
      detail:
        jobs.length > 0
          ? `${jobs.length} ${jobs.length === 1 ? "job" : "jobs"} added`
          : "Paste in the jobs you're going for",
      href: "/jobs",
      done: jobs.length > 0,
    },
    {
      label: "Tell me about yourself",
      detail: drafted.has(REQUIRED_STORY_TYPE_ID) ? "Written" : "The opener every interview starts with",
      href: aboutMe ? `/stories/${aboutMe.id}` : "/stories/new",
      done: drafted.has(REQUIRED_STORY_TYPE_ID),
    },
    {
      label: "Build the stories your jobs need",
      detail: plan.length > 0 ? `${planDone} of ${plan.length} written` : "Add a job to see which",
      href: plan.length > 0 ? "/jobs" : "/stories/new",
      done: plan.length > 0 && planDone === plan.length,
    },
  ];
}

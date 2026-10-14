import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { AddJobForm } from "@/app/jobs/forms";
import { getJobsPrep, listJobs } from "@/lib/jobs/data";
import { checklistItems, filledCount, hasEnoughNumbers } from "@/lib/numbers/checklist";
import { getNumbersChecklistSafely } from "@/lib/numbers/data";
import { hasDraft } from "@/lib/stories/content";
import { listStories } from "@/lib/stories/data";
import { REQUIRED_STORY_TYPE_ID } from "@/lib/stories/story-types";

// How many of the stories the user's jobs need most count toward the last step.
const PLAN_SIZE = 4;

type PathStep = { label: string; detail: string; href: string; done: boolean };

// Where the user is on the prep path (PRD: "Always show position"), shown on the home page as one
// bar: the next step and a button to it, with the four steps as dots. Before the first job, it's a
// single step instead: paste a job and see its likely questions, with nothing else to set up first.
export async function PrepPath() {
  let steps: PathStep[] | null;
  try {
    steps = await pathSteps();
  } catch (err) {
    unstable_rethrow(err);
    console.error("Home: loading the prep path failed", err);
    return null;
  }
  if (!steps) return <FirstJob />;
  const current = steps.findIndex((s) => !s.done);
  if (current < 0) return null;
  const step = steps[current];
  return (
    <nav
      aria-label="Your prep path"
      className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-navy-700/30"
      data-testid="prep-path"
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-navy-700">
          Next step
          <span className="flex gap-1" aria-label={`Step ${current + 1} of ${steps.length}`}>
            {steps.map((s, i) => (
              <span
                key={s.label}
                title={s.label}
                className={`size-2 rounded-full ${
                  s.done ? "bg-navy-800" : i === current ? "bg-amber-400" : "bg-navy-100"
                }`}
              />
            ))}
          </span>
        </p>
        <p className="mt-1 font-semibold text-slate-900">
          {step.label}
          <span className="font-normal text-slate-500"> · {step.detail}</span>
        </p>
      </div>
      <Link
        href={step.href}
        aria-current="step"
        className="shrink-0 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-navy-950 transition hover:bg-amber-300"
      >
        Continue
      </Link>
    </nav>
  );
}

function FirstJob() {
  return (
    <section
      className="mt-5 rounded-3xl bg-white p-6 shadow-sm ring-2 ring-navy-700/40 sm:p-8"
      data-testid="first-job"
    >
      <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
        Start with a job you&apos;re going for
      </h2>
      <p className="mt-2 max-w-2xl text-slate-600">
        Paste the posting or a link, and I&apos;ll show the questions they&apos;re most likely to
        ask. No resume needed.
      </p>
      <div className="mt-6">
        <AddJobForm submitLabel="Show my likely questions" />
      </div>
    </section>
  );
}

async function pathSteps(): Promise<PathStep[] | null> {
  const [jobs, { overview }, stories, numbers] = await Promise.all([
    listJobs(),
    getJobsPrep(),
    listStories(),
    getNumbersChecklistSafely(),
  ]);
  const drafted = new Set(stories.filter((s) => hasDraft(s.content)).map((s) => s.storyType));
  const aboutMe = stories.find((s) => s.storyType === REQUIRED_STORY_TYPE_ID);
  const plan = (overview?.storyOrder ?? [])
    .map((p) => p.storyType)
    .filter((t) => t !== REQUIRED_STORY_TYPE_ID)
    .slice(0, PLAN_SIZE);
  if (jobs.length === 0) return null;
  const predicted = jobs.find((j) => j.likelyQuestions);
  const planDone = plan.filter((t) => drafted.has(t)).length;

  return [
    {
      label: "See your likely questions",
      detail: predicted ? `Ready for ${predicted.title}` : `Predict them for ${jobs[0].title}`,
      href: predicted ? `/jobs/${predicted.id}` : `/jobs/${jobs[0].id}`,
      done: Boolean(predicted),
    },
    {
      label: "Gather your numbers",
      detail: numbers
        ? `${filledCount(numbers)} of ${checklistItems(numbers).length} filled in`
        : "The figures your stories need",
      href: "/numbers",
      done: hasEnoughNumbers(numbers),
    },
    {
      label: "Tell me about yourself",
      detail: drafted.has(REQUIRED_STORY_TYPE_ID) ? "Written" : "Most interviews open with it",
      href: aboutMe ? `/stories/${aboutMe.id}` : "/stories/new",
      done: drafted.has(REQUIRED_STORY_TYPE_ID),
    },
    {
      label: "Build the stories your jobs need",
      detail:
        plan.length > 0 ? `${planDone} of ${plan.length} written` : "See which on your jobs page",
      href: plan.length > 0 ? "/jobs" : "/stories/new",
      done: plan.length > 0 && planDone === plan.length,
    },
  ];
}

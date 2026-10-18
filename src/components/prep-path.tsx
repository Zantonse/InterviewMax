import Link from "next/link";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { AddJobForm } from "@/app/jobs/forms";
import { getAssessmentSafely } from "@/lib/assessment/data";
import { gradeJourney } from "@/lib/assessment/journey";
import { getJobsPrep, listJobs } from "@/lib/jobs/data";
import { checklistItems, filledCount, hasEnoughNumbers } from "@/lib/numbers/checklist";
import { getNumbersChecklistSafely } from "@/lib/numbers/data";
import { listPracticeSessionsSafely } from "@/lib/practice/data";
import { buildPlan, focusJob, planHeading, todayIn } from "@/lib/prep/plan";
import { listStories } from "@/lib/stories/data";
import { REQUIRED_STORY_TYPE_ID } from "@/lib/stories/story-types";

// How many of the stories the user's jobs need most count toward the story plan step.
const PLAN_SIZE = 4;

const ASSESSMENT_WHEN: Record<string, string> = {
  days: "in the next few days",
  soon: "within 2 weeks",
  later: "more than 2 weeks away",
};

// Where the user is on their prep plan (PRD: "Always show position" and "Time-boxed prep plan"),
// shown on the home page as one bar: the next step and a button to it, with the plan's steps as
// dots. The interview date on the nearest job sizes the plan (see src/lib/prep/plan.ts). Before the
// first job, it's a single step instead: paste a job and see its likely questions.
export async function PrepPath() {
  let loaded: Awaited<ReturnType<typeof loadPlan>>;
  try {
    loaded = await loadPlan();
  } catch (err) {
    unstable_rethrow(err);
    console.error("Home: loading the prep path failed", err);
    return null;
  }
  if (!loaded) return <FirstJob />;
  const { plan, job, nextInterview, journey } = loaded;
  const { steps } = plan;
  const current = steps.findIndex((s) => !s.done);
  // With no interview in view, a finished path steps aside; with one, it says you're ready.
  if (current < 0 && plan.basis === "none") return null;
  const step = current >= 0 ? steps[current] : null;
  const heading =
    plan.basis === "date" && plan.days !== null
      ? planHeading(plan.days, job.company)
      : plan.basis === "assessment" && nextInterview
        ? `Your plan for an interview ${ASSESSMENT_WHEN[nextInterview]}`
        : "Your next step";

  return (
    <nav
      aria-label="Your prep plan"
      className="mt-5 rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-ink-700/30"
      data-testid="prep-path"
      data-horizon={plan.horizon ?? "none"}
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-64">
          <h2 className="text-sm font-semibold text-ink-700" data-testid="plan-heading">
            {heading}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-semibold text-slate-900">
            <span data-testid="plan-step">
              {step ? `Step ${current + 1} of ${steps.length} · ${step.label}` : "You're ready"}
            </span>
            <span className="flex gap-1" aria-hidden>
              {steps.map((s, i) => (
                <span
                  key={s.id}
                  className={`size-2 rounded-full ${
                    s.done ? "bg-ink-800" : i === current ? "bg-accent-400" : "bg-ink-100"
                  }`}
                />
              ))}
            </span>
          </p>
          <p className="mt-0.5 text-sm text-slate-600">
            {step ? step.detail : "Read your brief and do the one-minute warm-up."}
          </p>
        </div>
        <Link
          href={step ? step.href : `/jobs/${job.id}/brief`}
          aria-current="step"
          className="w-full shrink-0 rounded-xl bg-accent-400 px-4 py-2.5 text-center text-sm font-semibold text-ink-950 transition hover:bg-accent-300 sm:w-auto"
        >
          {step ? "Continue" : "Open your brief"}
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {plan.basis !== "date" && (
          <Link
            href={`/jobs/${job.id}#interview-date`}
            className="font-semibold text-ink-800 hover:underline"
            data-testid="set-interview-date"
          >
            {plan.basis === "assessment" ? "Set the date" : "Interview booked? Add the date"} →
          </Link>
        )}
        {step && plan.horizon === "crunch" && (
          <Link
            href={`/jobs/${job.id}/brief`}
            className="font-semibold text-ink-800 hover:underline"
            data-testid="plan-brief"
          >
            Your pre-interview brief →
          </Link>
        )}
        {journey !== undefined && (
          <Link
            href="/assessment"
            className="font-semibold text-ink-800 hover:underline"
            data-testid="journey-link"
          >
            {journey ? `Journey check: ${journey}` : "Take the 1-minute journey check"} →
          </Link>
        )}
        {plan.horizon && (
          <details className="group w-full" data-testid="whole-plan">
            <summary className="cursor-pointer font-semibold text-ink-800 hover:underline">
              See the whole plan
            </summary>
            <ol className="mt-2 space-y-1">
              {steps.map((s) => (
                <li key={s.id} className="flex items-baseline gap-2">
                  <span aria-hidden className={s.done ? "text-ink-800" : "text-slate-400"}>
                    {s.done ? "✓" : "○"}
                  </span>
                  <Link
                    href={s.href}
                    className={
                      s.done ? "text-slate-500 line-through" : "text-slate-800 hover:underline"
                    }
                  >
                    {s.label}
                  </Link>
                  <span className="text-slate-500">· {s.detail}</span>
                </li>
              ))}
              {plan.later.map((s) => (
                <li key={s.id} className="flex items-baseline gap-2 text-slate-400">
                  <span aria-hidden>○</span>
                  <span>{s.label}</span>
                  <span>· coming soon</span>
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </nav>
  );
}

function FirstJob() {
  return (
    <section
      className="mt-5 rounded-3xl bg-white p-6 shadow-sm ring-2 ring-ink-700/40 sm:p-8"
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

async function loadPlan() {
  const [jobs, { overview }, stories, numbers, assessment, practice, requestHeaders] =
    await Promise.all([
      listJobs(),
      getJobsPrep(),
      listStories(),
      getNumbersChecklistSafely(),
      getAssessmentSafely(),
      listPracticeSessionsSafely(),
      headers(),
    ]);
  // Vercel sends the visitor's time zone, so "tomorrow" is the user's tomorrow.
  const today = todayIn(requestHeaders.get("x-vercel-ip-timezone"));
  const job = focusJob(jobs, today);
  if (!job) return null;
  const nextInterview =
    assessment && "answers" in assessment ? assessment.answers.nextInterview : null;
  const plan = buildPlan({
    job,
    today,
    nextInterview,
    stories,
    numbers: numbers
      ? {
          filled: filledCount(numbers),
          total: checklistItems(numbers).length,
          enough: hasEnoughNumbers(numbers),
        }
      : null,
    storyPlan: (overview?.storyOrder ?? [])
      .map((p) => p.storyType)
      .filter((t) => t !== REQUIRED_STORY_TYPE_ID)
      .slice(0, PLAN_SIZE),
    practiced: practice.some((s) => s.targetJobId === job.id && s.finishedAt),
  });
  // The journey check's verdict ("Nearly ready"), without its number: the bar gives feedback, not a
  // score. Undefined before the column exists, null when it hasn't been taken.
  const journey =
    assessment === undefined
      ? undefined
      : assessment && "answers" in assessment
        ? gradeJourney(assessment.answers, { hasJob: true }).level
        : null;
  return { plan, job, nextInterview, journey };
}

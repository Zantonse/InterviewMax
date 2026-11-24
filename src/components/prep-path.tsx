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
import { buildPlan, focusJob, todayIn, type Plan } from "@/lib/prep/plan";
import { listStories } from "@/lib/stories/data";
import { REQUIRED_STORY_TYPE_ID } from "@/lib/stories/story-types";
import { PlanToggle } from "./plan-toggle";

// How many of the stories the user's jobs need most count toward the story plan step.
const PLAN_SIZE = 4;

const ASSESSMENT_WHEN: Record<string, string> = {
  days: "in the next few days",
  soon: "within 2 weeks",
  later: "more than 2 weeks away",
};

// Today's step on home (PRD: "Always show position" and "Time-boxed prep plan"; design review
// 2026-11-23, fix 6): the one shaded block on the page, with the step, why it matters and a
// Continue button, and the whole plan one tap away. The interview date on the nearest job sizes the
// plan (see src/lib/prep/plan.ts). Before the first job, it's a single step instead: paste a job and
// see its likely questions.
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
  const forWhen =
    plan.basis === "assessment" && nextInterview
      ? `For an interview ${ASSESSMENT_WHEN[nextInterview]}`
      : null;

  return (
    <section
      aria-label="Today's step"
      className="mt-8 rounded-[10px] bg-ink-50 px-5 py-5 sm:px-6"
      data-testid="prep-path"
      data-horizon={plan.horizon ?? "none"}
    >
      <PlanToggle
        step={
          <>
            <p className="text-sm text-slate-600" data-testid="plan-heading">
              <span className="font-semibold text-slate-900">Today</span>
              {step && <span className="ml-2">Step {current + 1} of {steps.length}</span>}
              {forWhen && <span className="ml-2">· {forWhen}</span>}
            </p>
            <p className="mt-1.5 text-xl font-semibold text-slate-900" data-testid="plan-step">
              {step ? step.label : "You're ready"}
            </p>
            <p className="mt-1 text-slate-600">
              {step ? step.detail : "Read your brief and do the one-minute warm-up."}
            </p>
          </>
        }
        actions={
          <>
            {step && plan.horizon === "crunch" && (
              <Link href={`/jobs/${job.id}/brief`} className="link text-sm" data-testid="plan-brief">
                Pre-interview brief
              </Link>
            )}
            <Link
              href={step ? step.href : `/jobs/${job.id}/brief`}
              aria-current="step"
              className="btn-next"
            >
              {step ? "Continue" : "Open the brief"}
            </Link>
          </>
        }
        plan={
          steps.length > 1 || journey !== undefined ? (
            <WholePlan plan={plan} current={current} journey={journey} />
          ) : undefined
        }
      />
    </section>
  );
}

function WholePlan({
  plan,
  current,
  journey,
}: {
  plan: Plan;
  current: number;
  journey: string | null | undefined;
}) {
  return (
    <>
      <ol className="space-y-2 text-sm">
        {plan.steps.map((s, i) => (
          <li key={s.id} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2">
            <span aria-hidden className="font-mono text-xs leading-5 text-slate-500">
              {s.done ? "✓" : i + 1}
            </span>
            <span>
              <Link
                href={s.href}
                className={
                  s.done
                    ? "text-slate-500 line-through"
                    : i === current
                      ? "font-medium text-slate-900 hover:underline"
                      : "text-slate-800 hover:underline"
                }
              >
                {s.label}
              </Link>
              <span className="text-slate-600"> · {s.detail}</span>
            </span>
          </li>
        ))}
        {plan.later.map((s) => (
          <li key={s.id} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2 text-slate-500">
            <span aria-hidden>○</span>
            <span>{s.label} · coming soon</span>
          </li>
        ))}
      </ol>
      {journey !== undefined && (
        <p className="mt-3 text-sm">
          <Link href="/assessment" className="link" data-testid="journey-link">
            {journey ? `Journey check: ${journey}` : "Take the 1-minute journey check"}
          </Link>
        </p>
      )}
    </>
  );
}

function FirstJob() {
  return (
    <section className="mt-8 max-w-2xl" data-testid="first-job">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
        Start with a job you&apos;re going for
      </h2>
      <p className="mt-2 text-slate-600">
        Paste the posting or a link to see the questions they&apos;re most likely to ask. No resume
        needed.
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

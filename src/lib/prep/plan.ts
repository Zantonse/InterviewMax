import { coverageFor } from "@/lib/questions/coverage";
import { hasDraft, type StoryContent } from "@/lib/stories/content";
import { REQUIRED_STORY_TYPE_ID } from "@/lib/stories/story-types";
import { isToughType } from "@/lib/tough/questions";

// The time-boxed prep plan (PRD v0.3, P0): the date of the next interview sets which steps matter
// and in what order, and the first step not done is home's "Next step". Rules in code, no model call.
// With an interview tonight or tomorrow it's the top 3 likely questions and About me for that
// company and one tough question; with a week, stories for the top 5 and the numbers behind them;
// with two weeks or more, the full bank, each then practiced out loud. Steps for features not built
// yet are listed as coming later and never block.

export type Horizon = "crunch" | "week" | "full";

export type PlanStep = {
  id: string;
  label: string;
  detail: string;
  href: string;
  done: boolean;
};

// A step the plan calls for but the app can't do yet. Shown in the plan, never as the next step.
// (The pre-interview brief was one; it's built now, and home links to it once the plan is done.)
export type LaterStep = { id: string; label: string };

export type Plan = {
  horizon: Horizon | null;
  // Where the timing came from: a date on the job, the journey check's answer, or nothing.
  basis: "date" | "assessment" | "none";
  // Days until the interview, when there's a date.
  days: number | null;
  steps: PlanStep[];
  later: LaterStep[];
};

type StoryLike = {
  id: string;
  title: string;
  storyType: string | null;
  content: StoryContent;
};

export type PlanJob = {
  id: string;
  title: string;
  company: string | null;
  interviewDate: string | null;
  likelyQuestions: { questions: { theme: string }[] } | null;
};

export type PlanInput = {
  // The job the plan is for (see focusJob).
  job: PlanJob;
  today: string;
  // The journey check's "When is your next interview?", used until a job has a date.
  nextInterview?: string | null;
  stories: StoryLike[];
  numbers: { filled: number; total: number; enough: boolean } | null;
  // The story types the user's jobs need most, from the jobs read, About me left out.
  storyPlan: string[];
  // Whether the user has finished a practice round for this job.
  practiced?: boolean;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// Today's date (YYYY-MM-DD) where the user is, so "tomorrow" means their tomorrow. An unknown time
// zone falls back to UTC.
export function todayIn(timeZone: string | null | undefined, now = new Date()): string {
  const format = (tz: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  try {
    return format(timeZone || "UTC");
  } catch {
    return format("UTC");
  }
}

export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
}

export function horizonFor(days: number): Horizon {
  if (days <= 1) return "crunch";
  if (days <= 7) return "week";
  return "full";
}

const ASSESSMENT_HORIZON: Record<string, Horizon> = {
  days: "crunch",
  soon: "week",
  later: "full",
};

export function whenLabel(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 14) return `in ${days} days`;
  return `in ${Math.round(days / 7)} weeks`;
}

// The job with the nearest interview still ahead; with no dates, the first job with likely
// questions, then the first job. Null with no jobs.
export function focusJob<J extends PlanJob>(jobs: J[], today: string): J | null {
  const upcoming = jobs
    .filter((j) => j.interviewDate && daysUntil(j.interviewDate, today) >= 0)
    .sort((a, b) => a.interviewDate!.localeCompare(b.interviewDate!));
  return upcoming[0] ?? jobs.find((j) => j.likelyQuestions) ?? jobs[0] ?? null;
}

export function buildPlan(input: PlanInput): Plan {
  const { job, today } = input;
  const days =
    job.interviewDate && daysUntil(job.interviewDate, today) >= 0
      ? daysUntil(job.interviewDate, today)
      : null;
  const fromAssessment = input.nextInterview ? ASSESSMENT_HORIZON[input.nextInterview] : undefined;
  const horizon = days !== null ? horizonFor(days) : (fromAssessment ?? null);
  const basis = days !== null ? "date" : fromAssessment ? "assessment" : "none";
  // With an interview in view, About me is shaped for that company; otherwise the general one.
  const forJob = horizon !== null;

  const questions = questionsStep(job);
  const aboutMe = aboutMeStep(job, input.stories, forJob);
  const numbers = numbersStep(input.numbers);

  switch (horizon) {
    case "crunch":
      return {
        horizon,
        basis,
        days,
        steps: [questions, aboutMe, answersStep(job, input.stories, 3), toughStep(input.stories)],
        later: [],
      };
    case "week":
      return {
        horizon,
        basis,
        days,
        steps: [
          questions,
          aboutMe,
          numbers,
          answersStep(job, input.stories, 5),
          practiceStep(job, input.practiced),
        ],
        later: [],
      };
    default:
      return {
        horizon,
        basis,
        days,
        steps: [
          questions,
          numbers,
          aboutMe,
          storyPlanStep(input.storyPlan, input.stories),
          answersStep(job, input.stories),
          practiceStep(job, input.practiced),
        ],
        later: [],
      };
  }
}

// Practice mode: a round of the job's likely questions, out loud, with follow-ups. Last, once
// there are stories to practice.
function practiceStep(job: PlanJob, practiced = false): PlanStep {
  return {
    id: "practice",
    label: "Practice out loud with follow-ups",
    detail: practiced ? "A round done" : "Five questions, the weakest first",
    href: `/jobs/${job.id}/practice`,
    done: practiced,
  };
}

function questionsStep(job: PlanJob): PlanStep {
  return {
    id: "questions",
    label: "See your likely questions",
    detail: job.likelyQuestions ? `Ready for ${job.title}` : `Predict them for ${job.title}`,
    href: `/jobs/${job.id}`,
    done: Boolean(job.likelyQuestions),
  };
}

function aboutMeStep(job: PlanJob, stories: StoryLike[], forJob: boolean): PlanStep {
  const intros = stories.filter((s) => s.storyType === REQUIRED_STORY_TYPE_ID);
  const intro = intros.find((s) => hasDraft(s.content));
  if (!intro) {
    return {
      id: "aboutMe",
      label: "Tell me about yourself",
      detail: "Most interviews open with it",
      href: intros[0] ? `/stories/${intros[0].id}` : "/stories/new",
      done: false,
    };
  }
  if (!forJob) {
    return {
      id: "aboutMe",
      label: "Tell me about yourself",
      detail: "Written",
      href: `/stories/${intro.id}`,
      done: true,
    };
  }
  const tailored = Boolean(intro.content.tailored?.[job.id]?.draft);
  return {
    id: "aboutMe",
    label: `Tell me about yourself, for ${job.company || job.title}`,
    detail: tailored ? "Written for this job" : "Shape yours for this company",
    href: `/jobs/${job.id}#about-me`,
    done: tailored,
  };
}

function numbersStep(numbers: PlanInput["numbers"]): PlanStep {
  return {
    id: "numbers",
    label: "Gather your numbers",
    detail: numbers
      ? `${numbers.filled} of ${numbers.total} filled in`
      : "The figures your stories need",
    href: "/numbers",
    done: Boolean(numbers?.enough),
  };
}

function storyPlanStep(plan: string[], stories: StoryLike[]): PlanStep {
  const drafted = new Set(stories.filter((s) => hasDraft(s.content)).map((s) => s.storyType));
  const planDone = plan.filter((t) => drafted.has(t)).length;
  return {
    id: "storyPlan",
    label: "Build the stories your jobs need",
    detail:
      plan.length > 0 ? `${planDone} of ${plan.length} written` : "See which on your jobs page",
    href: plan.length > 0 ? "/jobs" : "/stories/new",
    done: plan.length > 0 && planDone === plan.length,
  };
}

// One tough question answered (why you're leaving, a gap, salary…): straight to the one in
// progress, or to the list to pick one.
function toughStep(stories: StoryLike[]): PlanStep {
  const tough = stories.filter((s) => isToughType(s.storyType));
  const written = tough.find((s) => hasDraft(s.content));
  const started = tough[0];
  return {
    id: "tough",
    label: "Prepare one tough question",
    detail: written ? written.title : "Why you're leaving, a gap, salary",
    href: written
      ? `/tough-questions/${written.id}`
      : started
        ? `/tough-questions/${started.id}`
        : "/tough-questions",
    done: Boolean(written),
  };
}

// A written story for each of the job's top `limit` likely questions (all of them with no limit).
function answersStep(job: PlanJob, stories: StoryLike[], limit?: number): PlanStep {
  const label = limit
    ? `Have a story for the top ${limit} questions`
    : "Have a story for every likely question";
  const all = job.likelyQuestions?.questions;
  if (!all) {
    return {
      id: "answers",
      label,
      detail: "Once your likely questions are in",
      href: `/jobs/${job.id}`,
      done: false,
    };
  }
  const questions = all.slice(0, limit);
  const coverage = questions.map((q) => coverageFor(q.theme, stories));
  const answered = coverage.filter((c) => c?.kind === "story" && c.drafted).length;
  // Straight to the story in progress for the first open question; to build one, the job page has
  // the button beside each question.
  const open = coverage.find((c) => !(c?.kind === "story" && c.drafted));
  return {
    id: "answers",
    label,
    detail: `${answered} of ${questions.length} answered`,
    href: open?.kind === "story" ? `/stories/${open.storyId}` : `/jobs/${job.id}`,
    done: answered === questions.length,
  };
}

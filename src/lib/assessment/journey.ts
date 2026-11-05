// The intake assessment (PRD v0.3, "Intake assessment and paywall"): a few taps on where the user
// is in their search, then rules in code (no model call) that place them on the prep journey and
// send them to the one step to start with. Kept on the profile row as profiles.intake_assessment;
// the result is worked out from the answers and from what the app already knows each time, so
// changes to these rules reach everyone and real progress counts without a retake.
//
// Plain data and pure functions, safe to import in client components.

import { REQUIRED_STORY_TYPE_ID } from "@/lib/stories/story-types";

export const QUESTIONS = [
  {
    id: "stage",
    question: "Where are you in your search?",
    options: [
      { id: "exploring", label: "Just starting to look" },
      { id: "applying", label: "Applying, no interviews yet" },
      { id: "screens", label: "Recruiter screens" },
      { id: "panels", label: "Hiring manager or panel rounds" },
      { id: "finals", label: "Final rounds" },
    ],
  },
  {
    id: "nextInterview",
    question: "When is your next interview?",
    options: [
      { id: "none", label: "None booked" },
      { id: "later", label: "More than 2 weeks away" },
      { id: "soon", label: "Within 2 weeks" },
      { id: "days", label: "In the next few days" },
    ],
  },
  {
    id: "targetJob",
    question: "Do you have a job you're going for?",
    options: [
      { id: "posting", label: "Yes, I have the posting" },
      { id: "role", label: "I know the kind of role" },
      { id: "unsure", label: "Not yet" },
    ],
  },
  {
    id: "stories",
    question: "How many interview stories with real numbers do you have ready?",
    options: [
      { id: "none", label: "None yet" },
      { id: "noNumbers", label: "Some, but without numbers" },
      { id: "some", label: "2 or 3 with numbers" },
      { id: "many", label: "5 or more with numbers" },
    ],
  },
  {
    // Where they feel stuck: the step it points to goes first, so they start where they need help.
    id: "focus",
    question: "What feels hardest about interviewing right now?",
    options: [
      { id: "questions", label: "Not knowing what they'll ask" },
      { id: "aboutMe", label: "Introducing myself" },
      { id: "stories", label: "Coming up with stories about my work" },
      { id: "outLoud", label: "Saying answers out loud under pressure" },
      { id: "unsure", label: "Not sure yet" },
    ],
  },
] as const;

type Question = (typeof QUESTIONS)[number];
export type QuestionId = Question["id"];
export type Answers = {
  [Q in Question as Q["id"]]: Q["options"][number]["id"];
};

// What profiles.intake_assessment holds: the answers once taken, or when the user skipped it.
export type Assessment = { answers: Answers; completedAt: string } | { skippedAt: string };

// Answers saved before a question existed get its neutral option, so earlier results still read.
// (Until Nov 2026 the fifth question asked about "Tell me about yourself"; the app now knows that
// from whether they've written one, so the old answer is ignored.)
const DEFAULTS: Partial<Answers> = { focus: "unsure" };

export function parseAnswers(raw: unknown): Answers | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const answers: Record<string, string> = {};
  for (const q of QUESTIONS) {
    const value = source[q.id] ?? DEFAULTS[q.id];
    if (!q.options.some((o) => o.id === value)) return null;
    answers[q.id] = value as string;
  }
  return answers as Answers;
}

export function parseAssessment(raw: unknown): Assessment | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  if (typeof source.completedAt === "string") {
    const answers = parseAnswers(source.answers);
    return answers ? { answers, completedAt: source.completedAt } : null;
  }
  if (typeof source.skippedAt === "string") return { skippedAt: source.skippedAt };
  return null;
}

// What the app already knows beats what the user said: a saved job closes the job step, a written
// "Tell me about yourself" closes that one, and written stories count toward the stories answer.
export type KnownProgress = { hasJob?: boolean; hasAboutMe?: boolean; storiesWritten?: number };

type StoryLike = { storyType: string | null; content: { draft?: unknown } };

export function knownProgress(stories: StoryLike[], hasJob: boolean): KnownProgress {
  const written = stories.filter((s) => Boolean(s.content.draft));
  return {
    hasJob,
    hasAboutMe: written.some((s) => s.storyType === REQUIRED_STORY_TYPE_ID),
    storiesWritten: written.filter((s) => s.storyType !== REQUIRED_STORY_TYPE_ID).length,
  };
}

// Readiness points; the three add up to 100. Where they are in the search, when the next interview
// is and what feels hardest don't score: they decide where to start. The number stays behind the
// scenes (Profile uses it for its readiness status); people see the level.
const TARGET_POINTS = { posting: 20, role: 10, unsure: 0 } as const;
const ABOUT_ME_POINTS = 35;
const STORY_POINTS = { many: 45, some: 30, noNumbers: 15, none: 0 } as const;
const STORY_RANK = ["none", "noNumbers", "some", "many"] as const;

const LEVELS = [
  { min: 85, label: "Interview-ready" },
  { min: 65, label: "Nearly ready" },
  { min: 35, label: "Building" },
  { min: 0, label: "Getting started" },
] as const;

export type StepId = "job" | "aboutMe" | "numbers" | "stories" | "practice";
export type Gap = { id: StepId; title: string; why: string };

const GAPS: Record<StepId, Gap> = {
  job: {
    id: "job",
    title: "Add the job you're going for",
    why: "Your likely questions come from the posting.",
  },
  aboutMe: {
    id: "aboutMe",
    title: "Tell me about yourself",
    why: "Most interviews open with it.",
  },
  numbers: {
    id: "numbers",
    title: "Stories with real numbers",
    why: "Numbers are what make a story believable.",
  },
  stories: {
    id: "stories",
    title: "A few more stories",
    why: "Five or so covers most behavioral rounds.",
  },
  practice: {
    id: "practice",
    title: "Practice out loud",
    why: "Follow-up questions are where answers come apart.",
  },
};

const MAX_STEPS = 3;

// Why the first step is first, in the user's terms.
export type StartReason = "focus" | "urgent" | "posting" | "stage" | "ready";

export type JourneyGrade = {
  score: number;
  level: (typeof LEVELS)[number]["label"];
  // An interview is days away, so the order favours what can be ready in time.
  urgent: boolean;
  // The path from here: up to three steps, the first one to take now. It always ends in practice
  // once nothing else is left.
  gaps: Gap[];
  next: { id: StepId };
  reason: StartReason;
  // One sentence on why they start there.
  why: string;
};

function effectiveStories(answer: Answers["stories"], written = 0): Answers["stories"] {
  const fromApp = written >= 5 ? "many" : written >= 2 ? "some" : "none";
  return STORY_RANK.indexOf(fromApp) > STORY_RANK.indexOf(answer) ? fromApp : answer;
}

const EARLY = new Set<Answers["stage"]>(["exploring", "applying"]);

export function gradeJourney(answers: Answers, known: KnownProgress = {}): JourneyGrade {
  const hasJob = Boolean(known.hasJob);
  const hasAboutMe = Boolean(known.hasAboutMe);
  const stories = effectiveStories(answers.stories, known.storiesWritten);
  const score =
    (hasJob ? TARGET_POINTS.posting : TARGET_POINTS[answers.targetJob]) +
    (hasAboutMe ? ABOUT_ME_POINTS : 0) +
    STORY_POINTS[stories];
  const level = LEVELS.find((l) => score >= l.min)!.label;
  const urgent = answers.nextInterview === "days";

  // What's still open on each part of the journey.
  const open: Partial<Record<StepId, true>> = {};
  if (!hasJob) open.job = true;
  if (!hasAboutMe) open.aboutMe = true;
  const storyStep: StepId | null =
    stories === "none" || stories === "noNumbers" ? "numbers" : stories === "some" ? "stories" : null;
  if (storyStep) open[storyStep] = true;
  const story = storyStep ?? "stories";

  // Where they are in the search sets the order. Before interviews, build what every interview
  // needs (About me, then stories). Recruiter screens open with "Tell me about yourself", then the
  // job. Hiring manager, panel and final rounds are mostly behavioral questions about this job.
  let order: StepId[] = EARLY.has(answers.stage)
    ? ["aboutMe", story, "job"]
    : answers.stage === "screens"
      ? ["aboutMe", "job", story]
      : ["job", story, "aboutMe"];
  let reason: StartReason = "stage";
  const toFront = (ids: StepId[]) => {
    order = [...ids, ...order.filter((id) => !ids.includes(id))];
  };

  // Value first: with a posting in hand and time to spare, the likely questions come first. With
  // an interview days away and no later rounds yet, About me is the fastest win.
  if (urgent && answers.stage !== "panels" && answers.stage !== "finals") {
    if (open.aboutMe) reason = "urgent";
    toFront(["aboutMe"]);
  } else if (!urgent && answers.targetJob === "posting") {
    if (open.job && order[0] !== "job") reason = "posting";
    toFront(["job"]);
  } else if (urgent) {
    reason = "urgent";
  }

  // What they said feels hardest goes first, when it's still open. Practice needs a job to practise
  // for, so without one the job comes just before it.
  const focus: StepId[] | null =
    answers.focus === "questions"
      ? hasJob ? ["practice"] : ["job"]
      : answers.focus === "aboutMe"
        ? ["aboutMe"]
        : answers.focus === "stories"
          ? [story]
          : answers.focus === "outLoud"
            ? hasJob ? ["practice"] : ["job", "practice"]
            : null;
  if (focus && (open[focus[0]] || focus[0] === "practice")) {
    reason = "focus";
    toFront(focus);
  }

  const path = order.filter((id) => open[id] || id === "practice");
  if (!path.includes("practice")) path.push("practice");
  const gaps = path.slice(0, MAX_STEPS).map((id) => GAPS[id]);
  const next = gaps[0].id;
  if (next === "practice" && reason !== "focus") reason = "ready";
  return { score, level, urgent, gaps, next: { id: next }, reason, why: whyStart(reason, next, answers) };
}

const FOCUS_WORDS: Record<Answers["focus"], string> = {
  questions: "not knowing what they'll ask",
  aboutMe: "introducing yourself",
  stories: "coming up with stories",
  outLoud: "saying answers out loud",
  unsure: "",
};

function whyStart(reason: StartReason, next: StepId, answers: Answers): string {
  switch (reason) {
    case "focus":
      return `You said ${FOCUS_WORDS[answers.focus]} feels hardest, so that's where we start.`;
    case "urgent":
      return "Your next interview is days away, so this starts with what can be ready in time.";
    case "posting":
      return "You have the posting, so start with the questions it's likely to bring up.";
    case "ready":
      return "The basics are in place, so the next step is saying it out loud.";
    case "stage":
      if (EARLY.has(answers.stage)) {
        return next === "job"
          ? "Before interviews start, a target job shows what to prepare for."
          : "Before interviews start, build the answers every interview needs.";
      }
      if (answers.stage === "screens") {
        return next === "aboutMe"
          ? "Recruiter screens almost always open with “Tell me about yourself”."
          : "Recruiter screens check your fit for the job, so start from the posting.";
      }
      return next === "job"
        ? "Later rounds dig into this job, so start from its likely questions."
        : "Later rounds are mostly behavioral questions, so your stories matter most.";
  }
}

// The intake assessment (PRD v0.3, "Intake assessment and paywall"): five taps on where the user
// is in their search, a journey grade from rules in code (no model call), and the one step they
// need next. Kept on the profile row as profiles.intake_assessment; the grade is worked out from
// the answers each time, so changes to these rules reach everyone.

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
    id: "aboutMe",
    question: "Can you answer “Tell me about yourself” in under 90 seconds?",
    options: [
      { id: "no", label: "Not yet" },
      { id: "rough", label: "Roughly, but it rambles" },
      { id: "yes", label: "Yes, confidently" },
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

export function parseAnswers(raw: unknown): Answers | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const answers: Record<string, string> = {};
  for (const q of QUESTIONS) {
    const value = source[q.id];
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

// Readiness points per answer; the three add up to 100. Where they are in the search and when the
// next interview is don't score: they set how urgent the gaps are.
const TARGET_POINTS = { posting: 20, role: 10, unsure: 0 } as const;
const ABOUT_ME_POINTS = { yes: 35, rough: 15, no: 0 } as const;
const STORY_POINTS = { many: 45, some: 30, noNumbers: 15, none: 0 } as const;

const LEVELS = [
  { min: 85, label: "Interview-ready" },
  { min: 65, label: "Nearly ready" },
  { min: 35, label: "Building" },
  { min: 0, label: "Getting started" },
] as const;

export type StepId = "job" | "aboutMe" | "numbers" | "stories" | "practice";
export type Gap = { id: Exclude<StepId, "practice">; title: string; why: string };

const GAPS: Record<Gap["id"], Gap> = {
  job: {
    id: "job",
    title: "Add the job you're going for",
    why: "Your likely questions come from the posting.",
  },
  aboutMe: {
    id: "aboutMe",
    title: "Tell me about yourself",
    why: "Most interviews open with it."
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
};

const MAX_GAPS = 3;

export type JourneyGrade = {
  score: number;
  level: (typeof LEVELS)[number]["label"];
  // An interview is days away, so the order favours what can be ready in time.
  urgent: boolean;
  gaps: Gap[];
  next: { id: StepId };
};

// What the app already knows beats what the user said: a saved job closes the job gap.
export type KnownProgress = { hasJob?: boolean };

export function gradeJourney(answers: Answers, known: KnownProgress = {}): JourneyGrade {
  const hasJob = Boolean(known.hasJob);
  const score =
    (hasJob ? TARGET_POINTS.posting : TARGET_POINTS[answers.targetJob]) +
    ABOUT_ME_POINTS[answers.aboutMe] +
    STORY_POINTS[answers.stories];
  const level = LEVELS.find((l) => score >= l.min)!.label;
  const urgent = answers.nextInterview === "days";

  const job = hasJob ? [] : [GAPS.job];
  const aboutMe = answers.aboutMe === "yes" ? [] : [GAPS.aboutMe];
  const stories =
    answers.stories === "none" || answers.stories === "noNumbers"
      ? [GAPS.numbers]
      : answers.stories === "some"
        ? [GAPS.stories]
        : [];

  // Value first: with a posting in hand and time to spare, the likely questions come first. With
  // an interview days away, About me is the fastest win. With no job in mind yet, About me is the
  // step that needs no posting.
  const ordered = urgent
    ? [...aboutMe, ...stories, ...job]
    : answers.targetJob === "unsure"
      ? [...aboutMe, ...stories, ...job]
      : [...job, ...aboutMe, ...stories];
  const gaps = ordered.slice(0, MAX_GAPS);
  return { score, level, urgent, gaps, next: { id: gaps[0]?.id ?? "practice" } };
}

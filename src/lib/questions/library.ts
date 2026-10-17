import { QUESTION_THEMES, type QuestionThemeId } from "./themes";

// The question library (PRD v0.3, P1): the behavioral questions interviewers ask most, by theme,
// for browsing outside any one job. Hand-written, like the themes: each theme's templates come
// first, then more common ways the same thing is asked. "senior" marks questions aimed at senior
// and leadership roles.

export type LibraryQuestion = {
  question: string;
  theme: QuestionThemeId;
  senior?: boolean;
};

const MORE: Record<QuestionThemeId, (string | [string, "senior"])[]> = {
  about_you: [
    "What are you known for at work?",
    "Why are you leaving your current role?",
    "What do you want to be doing in three years?",
    "What makes you a good fit for this team?",
    ["How would the people who report to you describe you?", "senior"],
  ],
  impact: [
    "Tell me about the biggest impact you've had in your current role.",
    "Tell me about a time you improved a process and what changed because of it.",
    "Tell me about a result you delivered with fewer resources than you wanted.",
    ["Tell me about a time you changed the direction of a product or a business.", "senior"],
    ["What's the largest scope you've owned, and what did you deliver with it?", "senior"],
  ],
  ownership: [
    "Tell me about a time you saw a problem nobody owned and took it on.",
    "Tell me about a time you went beyond what was asked.",
    "Tell me about a commitment you made that was hard to keep.",
    "Tell me about a time you had to make a call without your manager.",
    ["Tell me about something you built that still runs without you.", "senior"],
  ],
  conflict: [
    "Tell me about a time you had a conflict with a coworker.",
    "Tell me about a time you got critical feedback. What did you do with it?",
    "Tell me about a time you had to deliver bad news.",
    "Tell me about a time you pushed back on a request.",
    ["Tell me about a time two people on your team couldn't work together.", "senior"],
  ],
  influence: [
    "Tell me about a time you had to convince a skeptical stakeholder.",
    "Tell me about a time you changed a decision that had already been made.",
    "Tell me about a time you used data to win an argument.",
    "Tell me about a time you couldn't get buy-in. What happened?",
    ["Tell me about a time you influenced senior leaders.", "senior"],
  ],
  failure: [
    "Tell me about a project that didn't go the way you planned.",
    "Tell me about a time you missed a deadline.",
    "Tell me about a decision you'd make differently now.",
    "What's the most useful lesson you've learned from a setback?",
    ["Tell me about a time a bet you made didn't pay off.", "senior"],
  ],
  prioritization: [
    "Tell me about a time you had to say no to something important.",
    "How do you decide what to work on when everything is urgent?",
    "Tell me about a time you had to make a trade-off between speed and quality.",
    "Tell me about a decision you had to make quickly.",
    ["Tell me about a time you stopped a project that was already under way.", "senior"],
  ],
  collaboration: [
    "Tell me about a time you depended on another team that wasn't delivering.",
    "Tell me about a time you helped a colleague succeed.",
    "Tell me about working with someone whose style was very different from yours.",
    "Tell me about a time you brought together people who don't usually work together.",
    ["Tell me about a time you set up how several teams would work together.", "senior"],
  ],
  ambiguity: [
    "Tell me about a time you had to learn something new quickly.",
    "Tell me about a time priorities changed halfway through a project.",
    "Tell me about a time you had to act before you had all the facts.",
    "Tell me about a time you had to adapt to a reorganization or a new manager.",
    ["Tell me about a time you set direction where none existed.", "senior"],
  ],
  success: [
    "What does a great week look like in your current role?",
    "How do you know when a project has succeeded?",
    "Which of your goals from last year are you proudest of hitting?",
    "How would you know you were doing well here after six months?",
    ["How do you set goals for a team, and how do you track them?", "senior"],
  ],
};

export const LIBRARY: readonly LibraryQuestion[] = QUESTION_THEMES.flatMap((theme) => [
  ...theme.templates.map((question) => ({ question, theme: theme.id })),
  ...MORE[theme.id].map((q) =>
    typeof q === "string"
      ? { question: q, theme: theme.id }
      : { question: q[0], theme: theme.id, senior: true },
  ),
]);

// Where a question in the library view comes from: the library itself, one of the user's target
// jobs (its likely questions), or one of their own past interviews.
export type LibrarySource =
  | { kind: "library"; senior?: boolean }
  | { kind: "job"; jobId: string; title: string }
  | { kind: "transcript"; transcriptId: string; title: string }
  // Shared question bank: asked recently at a target job's company, e.g. "Asked at Acme, Sep 2026".
  | { kind: "bank"; label: string };

export type LibraryEntry = {
  question: string;
  theme: QuestionThemeId;
  sources: LibrarySource[];
};

// A question's key for spotting the same one twice: lower case, letters and digits only.
export function questionKey(question: string): string {
  return question
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .trim();
}

// The user's own questions first (likely for their jobs, then asked in their past interviews),
// then those asked recently at their jobs' companies, then the library. The same question from several places is one entry with every source.
export function buildLibrary(input: {
  jobs: { id: string; title: string; likelyQuestions: { questions: { question: string; theme: QuestionThemeId }[] } | null }[];
  transcripts: { id: string; title: string; asked: { question: string; theme: QuestionThemeId | null }[] }[];
  bank?: { question: string; theme: QuestionThemeId | null; label: string }[];
}): LibraryEntry[] {
  const entries = new Map<string, LibraryEntry>();
  const add = (question: string, theme: QuestionThemeId, source: LibrarySource) => {
    const key = questionKey(question);
    if (!key) return;
    const entry = entries.get(key);
    if (entry) entry.sources.push(source);
    else entries.set(key, { question, theme, sources: [source] });
  };
  for (const job of input.jobs) {
    for (const q of job.likelyQuestions?.questions ?? []) {
      add(q.question, q.theme, { kind: "job", jobId: job.id, title: job.title });
    }
  }
  for (const t of input.transcripts) {
    for (const q of t.asked) {
      if (q.theme) add(q.question, q.theme, { kind: "transcript", transcriptId: t.id, title: t.title });
    }
  }
  for (const q of input.bank ?? []) {
    if (q.theme) add(q.question, q.theme, { kind: "bank", label: q.label });
  }
  for (const q of LIBRARY) {
    add(q.question, q.theme, { kind: "library", ...(q.senior ? { senior: true } : {}) });
  }
  return [...entries.values()];
}

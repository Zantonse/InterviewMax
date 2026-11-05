import { questionKey, LIBRARY } from "@/lib/questions/library";
import { getTheme, type QuestionThemeId } from "@/lib/questions/themes";
import { TOUGH_QUESTIONS } from "@/lib/tough/questions";

// "Also answers": the other interview questions one written story can answer, not just the one it
// was built for. One model call (storyQuestions, see find.ts) per version of the story picks them
// from a list built here in code: the likely questions on the user's target jobs, questions they
// were asked in past interviews, questions other users were asked recently at the same companies,
// the story-shaped tough questions, and the question library. The model only picks by number, so
// every question shown is one the app already had, worded as it was. For each it says how well the
// story fits and what to lead with. It never changes the story.
//
// The picks also count as coverage (see coverageFor): a likely question with no story of its
// theme's type is covered by a written story that was found to answer it.

export const MAX_PICKS = 8;
// The longest candidate list sent to the model. The user's own questions always go in; the
// library fills what's left.
export const MAX_CANDIDATES = 120;

// Where a candidate question comes from, most personal first.
export type ReuseSource =
  | { kind: "job"; jobId: string; label: string }
  | { kind: "interview"; transcriptId: string; label: string }
  | { kind: "bank"; label: string }
  | { kind: "tough"; toughId: string }
  | { kind: "library" };

const SOURCE_RANK: Record<ReuseSource["kind"], number> = {
  job: 0,
  interview: 1,
  bank: 2,
  tough: 3,
  library: 4,
};

export type Candidate = {
  question: string;
  theme: QuestionThemeId | null;
  sources: ReuseSource[];
};

// How the story fits the question: as told, or once you lead with a different part of it.
export const FITS = [
  { id: "strong", label: "Fits as told", style: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  { id: "angle", label: "Lead differently", style: "bg-amber-50 text-amber-800 ring-amber-200" },
] as const;

export type FitId = (typeof FITS)[number]["id"];

export type AlsoAnswer = Candidate & {
  fit: FitId;
  // What to lead with and stress when this is the question, from what's in the story.
  emphasize: string;
};

export type StoryAlsoAnswers = {
  questions: AlsoAnswer[];
  model: string;
  // The draft this was made from. Stale once the story is rewritten or edited.
  draftWrittenAt: string;
  checkedAt: string;
};

// The tough questions a story can answer (the rest, like salary or a gap, are about the user's
// situation, not a story).
const STORY_TOUGH_IDS = new Set(["failure", "weakness", "ai_at_work"]);

// About-you questions ("walk me through your resume") are for the intro, not a story.
const SKIP_THEMES = new Set<string>(["about_you"]);

type JobInput = {
  id: string;
  title: string;
  company: string | null;
  likelyQuestions: { questions: { question: string; theme: QuestionThemeId }[] } | null;
};
type InterviewInput = {
  id: string;
  title: string;
  asked: { question: string; theme: QuestionThemeId | null }[];
};
type BankInput = { question: string; theme: QuestionThemeId | null; label: string };

// Every question the story could be checked against, one entry per question with all its sources,
// the user's own first. Leaves out the question the story was built for.
export function candidatePool(input: {
  jobs: JobInput[];
  interviews?: InterviewInput[];
  bank?: BankInput[];
  // The question the story was built for.
  asked?: string;
  max?: number;
}): Candidate[] {
  const max = input.max ?? MAX_CANDIDATES;
  const skip = input.asked ? questionKey(input.asked) : "";
  const entries = new Map<string, Candidate>();
  const add = (question: string, theme: QuestionThemeId | null, source: ReuseSource) => {
    const key = questionKey(question);
    if (!key || key === skip || (theme && SKIP_THEMES.has(theme))) return;
    const entry = entries.get(key);
    if (entry) {
      if (!entry.sources.some((s) => sameSource(s, source))) entry.sources.push(source);
      entry.theme ??= theme;
    } else if (entries.size < max) {
      entries.set(key, { question: question.trim(), theme, sources: [source] });
    }
  };
  for (const job of input.jobs) {
    for (const q of job.likelyQuestions?.questions ?? []) {
      add(q.question, q.theme, { kind: "job", jobId: job.id, label: job.company || job.title });
    }
  }
  for (const t of input.interviews ?? []) {
    for (const q of t.asked) add(q.question, q.theme, { kind: "interview", transcriptId: t.id, label: t.title });
  }
  for (const q of input.bank ?? []) add(q.question, q.theme, { kind: "bank", label: q.label });
  for (const t of TOUGH_QUESTIONS) {
    if (STORY_TOUGH_IDS.has(t.id)) add(t.label, null, { kind: "tough", toughId: t.id });
  }
  for (const q of LIBRARY) add(q.question, q.theme, { kind: "library" });
  return [...entries.values()];
}

function sameSource(a: ReuseSource, b: ReuseSource): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "job" && b.kind === "job") return a.jobId === b.jobId;
  if (a.kind === "interview" && b.kind === "interview") return a.transcriptId === b.transcriptId;
  if (a.kind === "bank" && b.kind === "bank") return a.label === b.label;
  if (a.kind === "tough" && b.kind === "tough") return a.toughId === b.toughId;
  return true;
}

// Short labels for where a question comes from, e.g. "Likely at Acme".
export function sourceLabels(sources: ReuseSource[]): string[] {
  const labels: string[] = [];
  const jobs = sources.flatMap((s) => (s.kind === "job" ? [s.label] : []));
  if (jobs.length) labels.push(`Likely at ${listOf(jobs)}`);
  if (sources.some((s) => s.kind === "interview")) labels.push("Asked you before");
  for (const s of sources) if (s.kind === "bank") labels.push(s.label);
  if (sources.some((s) => s.kind === "tough")) labels.push("Tough question");
  if (labels.length === 0 && sources.some((s) => s.kind === "library")) labels.push("Common question");
  return labels;
}

function listOf(items: string[]): string {
  const unique = [...new Set(items)];
  if (unique.length <= 2) return unique.join(" and ");
  return `${unique.slice(0, 2).join(", ")} and ${unique.length - 2} more`;
}

function rankOf(c: Candidate): number {
  return Math.min(...c.sources.map((s) => SOURCE_RANK[s.kind]));
}

// Fits as told first, then the user's own questions (target jobs, past interviews) before the rest.
export function orderPicks(picks: AlsoAnswer[]): AlsoAnswer[] {
  return picks
    .map((p, i) => ({ p, i }))
    .sort(
      (a, b) =>
        Number(a.p.fit !== "strong") - Number(b.p.fit !== "strong") ||
        rankOf(a.p) - rankOf(b.p) ||
        a.i - b.i,
    )
    .map(({ p }) => p);
}

// Whether the picks match the current draft.
export function alsoAnswersAreCurrent(
  also: StoryAlsoAnswers | undefined,
  draftWrittenAt: string | undefined,
): also is StoryAlsoAnswers {
  return Boolean(also && draftWrittenAt && also.draftWrittenAt === draftWrittenAt);
}

export function fitOf(id: FitId) {
  return FITS.find((f) => f.id === id) ?? FITS[1];
}

// The pick for this question on a story, when the story's current picks include it.
export function alsoAnswerFor(
  content: { draft?: { writtenAt: string }; alsoAnswers?: StoryAlsoAnswers },
  question: string,
): AlsoAnswer | undefined {
  if (!alsoAnswersAreCurrent(content.alsoAnswers, content.draft?.writtenAt)) return undefined;
  const key = questionKey(question);
  return content.alsoAnswers.questions.find((q) => questionKey(q.question) === key);
}

const FIT_IDS = new Set<string>(FITS.map((f) => f.id));
const MAX_EMPHASIS = 300;

// One pick from storage. Rejects anything without a question and a line on what to emphasize.
export function parseAlsoAnswer(raw: unknown): AlsoAnswer | undefined {
  if (!isRecord(raw) || typeof raw.question !== "string" || typeof raw.emphasize !== "string") {
    return undefined;
  }
  const question = raw.question.trim();
  const emphasize = raw.emphasize.trim().slice(0, MAX_EMPHASIS);
  if (!question || !emphasize) return undefined;
  const theme = getTheme(typeof raw.theme === "string" ? raw.theme : "")?.id ?? null;
  const fit = typeof raw.fit === "string" && FIT_IDS.has(raw.fit) ? (raw.fit as FitId) : "angle";
  const sources = Array.isArray(raw.sources) ? raw.sources.flatMap(parseSource) : [];
  return { question, theme, sources: sources.length ? sources : [{ kind: "library" }], fit, emphasize };
}

function parseSource(raw: unknown): ReuseSource[] {
  if (!isRecord(raw)) return [];
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  switch (raw.kind) {
    case "job":
      return str(raw.jobId) ? [{ kind: "job", jobId: str(raw.jobId), label: str(raw.label) }] : [];
    case "interview":
      return str(raw.transcriptId)
        ? [{ kind: "interview", transcriptId: str(raw.transcriptId), label: str(raw.label) }]
        : [];
    case "bank":
      return [{ kind: "bank", label: str(raw.label) }];
    case "tough":
      return str(raw.toughId) ? [{ kind: "tough", toughId: str(raw.toughId) }] : [];
    case "library":
      return [{ kind: "library" }];
    default:
      return [];
  }
}

export function parseAlsoAnswers(raw: unknown): StoryAlsoAnswers | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.questions)) return undefined;
  const questions = raw.questions.flatMap((q) => parseAlsoAnswer(q) ?? []).slice(0, MAX_PICKS);
  return {
    questions,
    model: typeof raw.model === "string" ? raw.model : "",
    draftWrittenAt: typeof raw.draftWrittenAt === "string" ? raw.draftWrittenAt : "",
    checkedAt: typeof raw.checkedAt === "string" ? raw.checkedAt : "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import { isRecord } from "@/lib/jobs/content";
import { getTheme, type QuestionThemeId } from "./themes";

// Likely questions (PRD, step 2): a short ranked list per target job, kept on
// target_jobs.likely_questions. The interview reports the user pasted are kept beside it.

export const MAX_QUESTIONS = 10;
export const MAX_REPORTS_LENGTH = 15000;

// Where a question came from: the standard set, something in the posting, or a report the user
// pasted from a public interview review.
export type QuestionSource = "common" | "posting" | "report";

export type LikelyQuestion = {
  question: string;
  theme: QuestionThemeId;
  // A few words on why it's likely for this job.
  why: string;
  source: QuestionSource;
  // True when it comes from something only this job asks for.
  specific: boolean;
};

export type LikelyQuestions = {
  questions: LikelyQuestion[];
  // Whether pasted interview reports were used.
  usedReports: boolean;
  model: string;
  generatedAt: string;
};

const SOURCES: readonly QuestionSource[] = ["common", "posting", "report"];

// Validates a list of questions from the model or from jsonb: known themes only, no duplicates,
// at most MAX_QUESTIONS, in the order given.
export function parseQuestionList(raw: unknown): LikelyQuestion[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: LikelyQuestion[] = [];
  for (const q of raw) {
    if (!isRecord(q) || typeof q.question !== "string") continue;
    const question = q.question.trim().slice(0, 300);
    const theme = getTheme(typeof q.theme === "string" ? q.theme.trim() : "");
    const key = question.toLowerCase();
    if (!question || !theme || seen.has(key)) continue;
    seen.add(key);
    const source = SOURCES.find((s) => s === q.source) ?? "common";
    result.push({
      question,
      theme: theme.id,
      why: typeof q.why === "string" ? q.why.trim().slice(0, 200) : "",
      source,
      specific: q.specific === true,
    });
    if (result.length >= MAX_QUESTIONS) break;
  }
  return result;
}

export function parseLikelyQuestions(raw: unknown): LikelyQuestions | null {
  if (!isRecord(raw)) return null;
  const questions = parseQuestionList(raw.questions);
  if (questions.length === 0) return null;
  return {
    questions,
    usedReports: raw.usedReports === true,
    model: typeof raw.model === "string" ? raw.model : "",
    generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : "",
  };
}

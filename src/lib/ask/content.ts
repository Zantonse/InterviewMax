import { isRecord } from "@/lib/jobs/content";

// Questions to ask the interviewer (PRD v0.3, P1): every interview ends with "Do you have any
// questions for us?". Each target job keeps a short list on target_jobs.questions_to_ask: the
// model's suggestions, drawn from the posting, the company and the level, plus any the user wrote.
// The user saves, edits or removes them; saved ones go in the pre-interview brief.

export const MIN_SUGGESTIONS = 5;
export const MAX_SUGGESTIONS = 8;
// Everything kept for one job: saved, suggested and the user's own.
export const MAX_ASK_QUESTIONS = 20;
export const MAX_ASK_LENGTH = 300;

// Who a question suits. Interview loops have different people in them, and a good question for
// the recruiter is a poor one for a future teammate.
export const AUDIENCES = [
  {
    id: "recruiter",
    label: "Recruiter",
    hint: "The process, the team and what happens next",
  },
  {
    id: "hiring_manager",
    label: "Hiring manager",
    hint: "The work, success and how they lead",
  },
  {
    id: "peer",
    label: "Future teammate",
    hint: "How the work really gets done day to day",
  },
  {
    id: "executive",
    label: "Senior leader",
    hint: "Direction, bets and what's changing",
  },
] as const;

export type AudienceId = (typeof AUDIENCES)[number]["id"];

export function isAudience(id: unknown): id is AudienceId {
  return AUDIENCES.some((a) => a.id === id);
}

export function audienceLabel(id: AudienceId): string {
  return AUDIENCES.find((a) => a.id === id)?.label ?? "";
}

export type AskQuestion = {
  id: string;
  question: string;
  audience: AudienceId;
  // A few words on what in the posting it comes from. Empty for the user's own.
  why: string;
  // Saved ones show in the brief; unsaved ones are suggestions a new round can replace.
  saved: boolean;
  // Written by the user rather than suggested.
  mine?: boolean;
};

export type QuestionsToAsk = {
  questions: AskQuestion[];
  // The model and time of the last round of suggestions; empty when there hasn't been one.
  model: string;
  generatedAt: string;
};

// Questions that belong after an offer, not in an interview: pay, benefits, time off.
const OFFER_STAGE_RE =
  /\b(salary|salaries|compensation|bonus(es)?|equity|stock options?|benefits|vacation|pto|paid time off|time off|perks)\b/i;

export function isOfferStageQuestion(question: string): boolean {
  return OFFER_STAGE_RE.test(question);
}

export function newAskId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// Validates a list from the model, the browser or jsonb: known audiences, trimmed text, no
// duplicates, at most `max`, in the order given. Missing ids get new ones.
export function parseAskList(raw: unknown, max = MAX_ASK_QUESTIONS): AskQuestion[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const ids = new Set<string>();
  const result: AskQuestion[] = [];
  for (const q of raw) {
    if (!isRecord(q) || typeof q.question !== "string") continue;
    const question = q.question.replace(/\s+/g, " ").trim().slice(0, MAX_ASK_LENGTH);
    const key = questionKey(question);
    if (!question || !key || seen.has(key)) continue;
    const audience = isAudience(q.audience) ? q.audience : "hiring_manager";
    let id = typeof q.id === "string" && /^[a-z0-9-]{1,40}$/i.test(q.id) ? q.id : newAskId();
    while (ids.has(id)) id = newAskId();
    seen.add(key);
    ids.add(id);
    result.push({
      id,
      question,
      audience,
      why: typeof q.why === "string" ? q.why.replace(/\s+/g, " ").trim().slice(0, 200) : "",
      saved: q.saved === true,
      ...(q.mine === true ? { mine: true } : {}),
    });
    if (result.length >= max) break;
  }
  return result;
}

export function parseQuestionsToAsk(raw: unknown): QuestionsToAsk | null {
  if (!isRecord(raw)) return null;
  const questions = parseAskList(raw.questions);
  if (questions.length === 0) return null;
  return {
    questions,
    model: typeof raw.model === "string" ? raw.model : "",
    generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : "",
  };
}

// A new round of suggestions: the saved ones and the user's own stay, in their order; the old
// unsaved suggestions are replaced by the new ones, minus any that repeat a kept question.
export function mergeSuggestions(kept: AskQuestion[], fresh: AskQuestion[]): AskQuestion[] {
  const keep = kept.filter((q) => q.saved || q.mine);
  const seen = new Set(keep.map((q) => questionKey(q.question)));
  const added = fresh.filter((q) => !seen.has(questionKey(q.question)));
  return parseAskList([...keep, ...added.map((q) => ({ ...q, saved: false, mine: false }))]);
}

// The saved questions, grouped by audience in AUDIENCES order (empty groups left out).
export function savedByAudience(
  questions: AskQuestion[],
): { audience: AudienceId; label: string; questions: AskQuestion[] }[] {
  const saved = questions.filter((q) => q.saved);
  return AUDIENCES.flatMap((a) => {
    const group = saved.filter((q) => q.audience === a.id);
    return group.length ? [{ audience: a.id, label: a.label, questions: group }] : [];
  });
}

// Two questions are the same when they match ignoring case, spacing and punctuation.
function questionKey(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

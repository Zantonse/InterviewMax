import type { TranscriptAnalysis } from "@/lib/transcripts/content";
import { toughForAsked } from "@/lib/tough/questions";

// Case and technical questions (tester material, Oct 17): analyst interviews lean on questions
// that no story answers, such as "car-wash accessories sell with Coke, what does that tell you?",
// "should we add a premium battery line, and how would you test it?" or "how do you use SQL?".
// Likely questions are behavioral only, so these come from the user's past interviews (the review
// marks them with no theme) or the user types their own. The answer frames are scripted; one
// model call ("casePractice") gives feedback on a practice answer (see prompts.ts).

export type CaseKind = "case" | "skill";

export const CASE_FRAMES: Record<
  CaseKind,
  { label: string; blurb: string; steps: readonly { id: string; label: string; hint: string }[] }
> = {
  case: {
    label: "Case question",
    blurb: "A business problem to think through out loud. They're grading how you reason, not the answer.",
    steps: [
      { id: "goal", label: "Clarify the goal", hint: "Say what decision it's for. Ask one question if you need to." },
      { id: "breakdown", label: "Break it down", hint: "Two or three things you'd look at, in order." },
      { id: "data", label: "Name the data", hint: "Which numbers, from where, compared with what." },
      { id: "test", label: "Test before betting", hint: "A small test that rules out season, region or store mix." },
      { id: "recommend", label: "Recommend", hint: "What you'd do, and the risk you'd watch." },
    ],
  },
  skill: {
    label: "Skills question",
    blurb: "A check on a tool or skill. Plain and specific beats modest and vague.",
    steps: [
      { id: "level", label: "Say your level plainly", hint: "What you can do with it today, without \"moderate at best\"." },
      { id: "example", label: "One real example", hint: "A time you used it: the problem, what you did, what it fixed." },
      { id: "edge", label: "Where you'd lean on others", hint: "The limit, and how you'd close it fast." },
    ],
  },
};

const SKILL_RE =
  /\b(?:sql|sequel|python|tableau|power bi|excel|vba|r\b|sas|programming|languages?|tools?|software|technical skills?|experience with|how comfortable)\b/i;

export function caseKind(question: string): CaseKind {
  return SKILL_RE.test(question) ? "skill" : "case";
}

// Screening and logistics questions the tough-questions coach doesn't cover: the review keeps
// them now, but they aren't cases to practice.
const SCREENING_RE =
  /\b(?:timeline|start date|when (?:could|can) you start|notice period|travel|relocat\w*|on-?site|remote|hybrid|visa|sponsor\w*|salary|compensation|comp\b|pay range|number\b.*\btarget\w*|other (?:interviews|offers)|questions for (?:me|us)|anything (?:else )?(?:you'd like to|to) ask)/i;

// A question with no theme that isn't for the tough-questions coach or plain screening.
export function isCaseQuestion(question: string): boolean {
  return !toughForAsked(question) && !SCREENING_RE.test(question);
}

export const MAX_CASE_QUESTION_LENGTH = 400;
export const MAX_CASE_ANSWER_LENGTH = 6000;

export type CaseQuestion = {
  question: string;
  kind: CaseKind;
  // From a past interview: where it was asked and how the answer landed then.
  transcriptId?: string;
  transcriptTitle?: string;
  landed?: string;
  note?: string;
  // Asked in an interview for this job or at this company, rather than elsewhere.
  here: boolean;
};

type TranscriptLike = {
  id: string;
  title: string;
  targetJobId: string | null;
  company: string | null;
  analysis: TranscriptAnalysis | null;
};

// The non-behavioral questions from past interviews: this job's and this company's first, then
// (fewer) from interviews elsewhere. Screening questions (salary, why you're looking) are left
// out: they have the tough-questions coach, and logistics aren't cases.
export function caseQuestionsFor(
  job: { id: string; company: string | null },
  transcripts: TranscriptLike[],
  { maxHere = 10, maxElsewhere = 5 } = {},
): CaseQuestion[] {
  const company = job.company?.trim().toLowerCase();
  const here: CaseQuestion[] = [];
  const elsewhere: CaseQuestion[] = [];
  const seen = new Set<string>();
  for (const t of transcripts) {
    if (!t.analysis) continue;
    const same = t.targetJobId === job.id || (Boolean(company) && t.company?.trim().toLowerCase() === company);
    for (const q of t.analysis.asked) {
      if (q.theme || !isCaseQuestion(q.question)) continue;
      const key = q.question.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      (same ? here : elsewhere).push({
        question: q.question,
        kind: caseKind(q.question),
        transcriptId: t.id,
        transcriptTitle: t.title,
        landed: q.landed,
        note: q.note,
        here: same,
      });
    }
  }
  return [...here.slice(0, maxHere), ...elsewhere.slice(0, maxElsewhere)];
}

// Feedback on one practice answer. Not saved: practicing a case is about the reps.
export type CaseFeedback = {
  summary: string;
  // Frame steps the answer covered.
  covered: string[];
  // What to add, most important first, each tied to a frame step.
  missing: { step: string; tip: string }[];
  // The push an interviewer would likely make next.
  followUp: string;
};

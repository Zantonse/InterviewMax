import { savedByAudience, type AudienceId, type QuestionsToAsk } from "@/lib/ask/content";
import type { LikelyQuestion } from "@/lib/questions/content";
import { coverageFor } from "@/lib/questions/coverage";
import { getTheme } from "@/lib/questions/themes";
import { checklistItems, type NumbersChecklist } from "@/lib/numbers/checklist";
import { hasDraft, type StoryContent } from "@/lib/stories/content";
import {
  INTRO_PARTS,
  REQUIRED_STORY_TYPE_ID,
  STAR_PARTS,
  TAILORED_PARTS,
  getStoryType,
} from "@/lib/stories/story-types";
import type { RoundId } from "@/lib/bank/content";
import { STAGE_GUIDES, orderForStage } from "@/lib/stages/stages";
import {
  AI_ANSWER_ID,
  getToughQuestion,
  isToughType,
  storyHref,
  toughStoryType,
} from "@/lib/tough/questions";

// The pre-interview brief (PRD v0.3, P0): one page per target job to read just before walking in,
// and the one-minute warm-up at its top. Assembled in code from what the user already has (About
// me for this job, likely questions and the stories that answer them, their numbers, their tough
// answers, including how they use AI). No model call, so every line on it comes from their own data.

// Likely questions shown on the brief; the warm-up takes the top few.
export const BRIEF_QUESTIONS = 8;
export const WARM_UP_QUESTIONS = 3;
export const WARM_UP_NUMBERS = 3;
// A reminder is one line: cut at the first sentence, and at this many characters.
const MAX_REMINDER_LENGTH = 160;

type StoryLike = {
  id: string;
  title: string;
  storyType: string | null;
  content: StoryContent;
};

type JobLike = {
  id: string;
  title: string;
  company: string | null;
  likelyQuestions: { questions: LikelyQuestion[] } | null;
  questionsToAsk?: QuestionsToAsk | null;
};

export type BriefIntro = {
  // "tailored" when written for this job on its page; "general" is the user's main About me.
  kind: "tailored" | "general";
  // The user's own answer to "Why this company?", when they gave one for this job.
  whyCompany?: string;
  // The answer as written, paragraph by paragraph.
  paragraphs: string[];
  storyId: string;
};

export type BriefQuestion = {
  question: string;
  theme: string;
  themeLabel: string;
  // The story to answer with: written, or started but not written yet. Missing when it's a gap.
  story?: {
    id: string;
    title: string;
    href: string;
    drafted: boolean;
    reminder: string;
    // The written story, part by part, for the warm-up's "Show the story".
    paragraphs: string[];
  };
  // The story type to build when it's a gap.
  buildType?: string;
};

export type BriefNumber = { id: string; label: string; value: string };

// The questions the user saved to ask at the end, grouped by who they suit.
export type BriefAsk = {
  groups: { audience: AudienceId; label: string; questions: string[] }[];
  // Suggestions on the job page not saved yet, so the brief can point there.
  unsaved: number;
};

export type BriefTough = { id: string; question: string; answer: string; href: string };

// The interview stage the brief is shaped for (recruiter screen, hiring manager…), when known.
export type BriefStage = {
  id: RoundId;
  label: string;
  // True when it's the interview timeline's guess, not a stage the user picked.
  guessed: boolean;
  checks: string;
  tips: string[];
};

export type Brief = {
  job: { id: string; title: string; company: string | null };
  stage: BriefStage | null;
  intro: BriefIntro | null;
  questions: BriefQuestion[];
  // How many likely questions the job has beyond those shown.
  moreQuestions: number;
  numbers: BriefNumber[];
  // Likely questions with no written story, most likely first.
  gaps: BriefQuestion[];
  tough: BriefTough[];
  ask: BriefAsk;
};

export function buildBrief(input: {
  job: JobLike;
  stories: StoryLike[];
  numbers: NumbersChecklist | null;
  // The stage to shape it for: its questions, tough answers and questions to ask come first.
  stage?: { id: RoundId; guessed: boolean } | null;
}): Brief {
  const { job, stories } = input;
  const stageId = input.stage?.id ?? null;
  const guide = stageId ? STAGE_GUIDES[stageId] : null;
  const all = orderForStage(job.likelyQuestions?.questions ?? [], stageId);
  const count = guide?.themes.length ? guide.questions : BRIEF_QUESTIONS;
  const questions = all.slice(0, count).map((q) => briefQuestion(q, stories, job.id));
  const usedTypes = new Set(
    questions.flatMap((q) => {
      const s = q.story && stories.find((x) => x.id === q.story!.id);
      return s?.storyType ? [s.storyType] : [];
    }),
  );
  return {
    job: { id: job.id, title: job.title, company: job.company },
    stage:
      guide && guide.tips.length
        ? {
            id: guide.id,
            label: guide.label,
            guessed: Boolean(input.stage?.guessed),
            checks: guide.checks,
            tips: guide.tips,
          }
        : null,
    intro: introFor(job.id, stories),
    questions,
    moreQuestions: Math.max(0, all.length - questions.length),
    numbers: keyNumbers(input.numbers, usedTypes),
    gaps: questions.filter((q) => !q.story?.drafted),
    tough: toughForStage(toughAnswers(stories, job.id), stories, stageId),
    ask: askForStage(askFor(job.questionsToAsk?.questions ?? []), stageId),
  };
}

function briefQuestion(q: LikelyQuestion, stories: StoryLike[], jobId: string): BriefQuestion {
  const coverage = coverageFor(q.theme, stories);
  const base = { question: q.question, theme: q.theme, themeLabel: getTheme(q.theme)?.label ?? "" };
  if (coverage?.kind !== "story") {
    return { ...base, ...(coverage ? { buildType: coverage.storyType } : {}) };
  }
  const story = stories.find((s) => s.id === coverage.storyId);
  return {
    ...base,
    story: {
      id: coverage.storyId,
      title: coverage.title,
      href:
        story?.storyType === REQUIRED_STORY_TYPE_ID && story.content.tailored?.[jobId]?.draft
          ? `/jobs/${jobId}#about-me`
          : `/stories/${coverage.storyId}`,
      drafted: coverage.drafted,
      reminder: story ? storyReminder(story, jobId) : "",
      paragraphs: story ? storyParagraphs(story.content, story.storyType) : [],
    },
  };
}

// One line to jog the memory: for a behavioral story, its result (the figure an interviewer
// remembers); for "Tell me about yourself", its proof point for this job, else its highlight.
export function storyReminder(story: StoryLike, jobId?: string): string {
  const draft = story.content.draft;
  if (story.storyType === REQUIRED_STORY_TYPE_ID) {
    const tailored = jobId ? story.content.tailored?.[jobId]?.draft : undefined;
    const text = tailored?.parts.proof || draft?.parts.highlight || story.content.answers.highlight;
    return firstSentence(text ?? "");
  }
  if (!draft) return "";
  const order = ["result", "actions", "situation"];
  for (const part of order) {
    const line = firstSentence(draft.parts[part] ?? "");
    if (line) return line;
  }
  return "";
}

// The first sentence of a paragraph, cut to one line.
export function firstSentence(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  // A sentence ends at . ! or ? followed by a space and a capital, so "$2.4M" and "e.g. this" stay whole.
  const match = clean.match(/^.+?[.!?](?=\s+["“A-Z0-9]|$)/);
  const sentence = (match ? match[0] : clean).trim();
  if (sentence.length <= MAX_REMINDER_LENGTH) return sentence;
  const cut = sentence.slice(0, MAX_REMINDER_LENGTH);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 80 ? cut.lastIndexOf(" ") : cut.length).trim()}…`;
}

// About me for this job when it's been written on the job page, else the main one.
function introFor(jobId: string, stories: StoryLike[]): BriefIntro | null {
  const intros = stories.filter((s) => s.storyType === REQUIRED_STORY_TYPE_ID);
  const tailoredStory = intros.find((s) => s.content.tailored?.[jobId]?.draft);
  if (tailoredStory) {
    const tailored = tailoredStory.content.tailored![jobId];
    const paragraphs = TAILORED_PARTS.map((p) => tailored.draft!.parts[p.id]?.trim()).filter(
      (p): p is string => Boolean(p),
    );
    if (paragraphs.length) {
      return {
        kind: "tailored",
        ...(tailored.whyCompany.trim() ? { whyCompany: tailored.whyCompany.trim() } : {}),
        paragraphs,
        storyId: tailoredStory.id,
      };
    }
  }
  const general = intros.find((s) => hasDraft(s.content));
  if (!general?.content.draft) return null;
  const paragraphs = INTRO_PARTS.map((p) => general.content.draft!.parts[p.id]?.trim()).filter(
    (p): p is string => Boolean(p),
  );
  if (!paragraphs.length) return null;
  const why = intros.find((s) => s.content.tailored?.[jobId]?.whyCompany.trim())?.content
    .tailored?.[jobId]?.whyCompany;
  return {
    kind: "general",
    ...(why?.trim() ? { whyCompany: why.trim() } : {}),
    paragraphs,
    storyId: general.id,
  };
}

// The numbers the user filled in, those that suit the stories this brief points to first.
function keyNumbers(checklist: NumbersChecklist | null, usedTypes: Set<string>): BriefNumber[] {
  if (!checklist) return [];
  const filled = checklistItems(checklist).flatMap((item) => {
    const value = checklist.values[item.id]?.trim();
    if (!value) return [];
    const fits = item.storyTypes.length === 0 || item.storyTypes.some((t) => usedTypes.has(t));
    return [{ number: { id: item.id, label: item.label, value }, fits }];
  });
  return [...filled.filter((n) => n.fits), ...filled.filter((n) => !n.fits)].map((n) => n.number);
}

// Written tough answers (why you're leaving, a gap, salary…), one per question, latest first. How
// you use AI comes first, in the version shaped for this job when there is one.
function toughAnswers(stories: StoryLike[], jobId: string): BriefTough[] {
  const seen = new Set<string>();
  const answers = stories.flatMap((s) => {
    if (!isToughType(s.storyType) || seen.has(s.storyType!)) return [];
    const forJob = s.content.tough?.forJobs?.[jobId]?.answer.trim();
    const answer = forJob || s.content.draft?.parts.answer?.trim();
    const question = getToughQuestion(s.storyType);
    if (!answer || !question) return [];
    seen.add(s.storyType!);
    const href = forJob ? `/jobs/${jobId}#ai-answer` : storyHref(s);
    return [{ id: s.id, question: question.label, answer, href }];
  });
  const ai = toughStoryType(AI_ANSWER_ID);
  return [
    ...answers.filter((t) => stories.find((s) => s.id === t.id)?.storyType === ai),
    ...answers.filter((t) => stories.find((s) => s.id === t.id)?.storyType !== ai),
  ];
}

// Tough answers this stage asks most first, in the stage's order; the rest keep their order.
function toughForStage(
  answers: BriefTough[],
  stories: StoryLike[],
  stage: RoundId | null,
): BriefTough[] {
  const order = stage ? STAGE_GUIDES[stage].tough.map((id) => toughStoryType(id)) : [];
  if (!order.length) return answers;
  const rank = (t: BriefTough) => {
    const i = order.indexOf(stories.find((s) => s.id === t.id)?.storyType ?? "");
    return i === -1 ? order.length : i;
  };
  return answers
    .map((t, index) => ({ t, index }))
    .sort((a, b) => rank(a.t) - rank(b.t) || a.index - b.index)
    .map((x) => x.t);
}

// Questions to ask for the person this stage is with first (the recruiter at a recruiter screen).
function askForStage(ask: BriefAsk, stage: RoundId | null): BriefAsk {
  const order = stage ? STAGE_GUIDES[stage].audiences : [];
  if (!order.length) return ask;
  const rank = (a: AudienceId) => (order.includes(a) ? order.indexOf(a) : order.length);
  return {
    ...ask,
    groups: ask.groups
      .map((g, index) => ({ g, index }))
      .sort((a, b) => rank(a.g.audience) - rank(b.g.audience) || a.index - b.index)
      .map((x) => x.g),
  };
}

// The saved questions to ask, by audience, and how many suggestions are still unsaved.
function askFor(questions: QuestionsToAsk["questions"]): BriefAsk {
  return {
    groups: savedByAudience(questions).map((g) => ({
      audience: g.audience,
      label: g.label,
      questions: g.questions.map((q) => q.question),
    })),
    unsaved: questions.filter((q) => !q.saved).length,
  };
}

// The one-minute warm-up: the stage's reminders when one is set, About me, three numbers, then the top questions with their stories, one
// card at a time, to read or say out loud.
export type WarmUpCard =
  | { kind: "stage"; stage: BriefStage }
  | { kind: "intro"; intro: BriefIntro }
  | { kind: "numbers"; numbers: BriefNumber[] }
  | { kind: "question"; index: number; question: BriefQuestion };

export function warmUpCards(brief: Brief): WarmUpCard[] {
  const cards: WarmUpCard[] = [];
  if (brief.stage) cards.push({ kind: "stage", stage: brief.stage });
  if (brief.intro) cards.push({ kind: "intro", intro: brief.intro });
  const numbers = brief.numbers.slice(0, WARM_UP_NUMBERS);
  if (numbers.length) cards.push({ kind: "numbers", numbers });
  // "Tell me about yourself" already has its own card.
  brief.questions
    .filter((q) => !(brief.intro && q.theme === "about_you"))
    .slice(0, WARM_UP_QUESTIONS)
    .forEach((question, index) => cards.push({ kind: "question", index, question }));
  return cards;
}

// The parts of a written story, in the order it is told.
export function storyParagraphs(content: StoryContent, storyType: string | null): string[] {
  const draft = content.draft;
  if (!draft) return [];
  const parts = getStoryType(storyType)?.format === "intro" ? INTRO_PARTS : STAR_PARTS;
  return parts.map((p) => draft.parts[p.id]?.trim()).filter((p): p is string => Boolean(p));
}

// Questions worth asking at the end of any interview, shown until the user saves some written for
// the job (see src/lib/ask).
export const STARTER_QUESTIONS = [
  "What would success look like in the first 90 days?",
  "What's the biggest challenge the team is facing right now?",
  "How does the team decide what to work on next?",
  "What do the people who do best here have in common?",
  "What are the next steps, and is there anything you'd like me to expand on?",
] as const;

// For an in-person round (PRD, interview trends 2026: Google, Cisco and McKinsey brought them back,
// largely because of AI cheating). The same for every job, so it's written here, not generated.
export const IN_PERSON_NOTES = [
  "Expect no notes and no screen: tell your stories from memory, so warm up with them out loud first.",
  "Bring a printed copy of your resume, and know the numbers on it without looking.",
  "Plan to arrive 10 to 15 minutes early, with a photo ID: some companies now check who you are.",
  "Follow-ups land faster face to face. Pause, then answer the question they asked, with one specific.",
] as const;

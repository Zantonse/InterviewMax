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
import { getToughQuestion, isToughType, storyHref } from "@/lib/tough/questions";

// The pre-interview brief (PRD v0.3, P0): one page per target job to read just before walking in,
// and the one-minute warm-up at its top. Assembled in code from what the user already has (About
// me for this job, likely questions and the stories that answer them, their numbers, their tough
// answers). No model call, so every line on it comes from their own data.

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

export type BriefTough = { id: string; question: string; answer: string; href: string };

export type Brief = {
  job: { id: string; title: string; company: string | null };
  intro: BriefIntro | null;
  questions: BriefQuestion[];
  // How many likely questions the job has beyond those shown.
  moreQuestions: number;
  numbers: BriefNumber[];
  // Likely questions with no written story, most likely first.
  gaps: BriefQuestion[];
  tough: BriefTough[];
};

export function buildBrief(input: {
  job: JobLike;
  stories: StoryLike[];
  numbers: NumbersChecklist | null;
}): Brief {
  const { job, stories } = input;
  const all = job.likelyQuestions?.questions ?? [];
  const questions = all.slice(0, BRIEF_QUESTIONS).map((q) => briefQuestion(q, stories, job.id));
  const usedTypes = new Set(
    questions.flatMap((q) => {
      const s = q.story && stories.find((x) => x.id === q.story!.id);
      return s?.storyType ? [s.storyType] : [];
    }),
  );
  return {
    job: { id: job.id, title: job.title, company: job.company },
    intro: introFor(job.id, stories),
    questions,
    moreQuestions: Math.max(0, all.length - questions.length),
    numbers: keyNumbers(input.numbers, usedTypes),
    gaps: questions.filter((q) => !q.story?.drafted),
    tough: toughAnswers(stories),
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

// Written tough answers (why you're leaving, a gap, salary…), one per question, latest first.
function toughAnswers(stories: StoryLike[]): BriefTough[] {
  const seen = new Set<string>();
  return stories.flatMap((s) => {
    if (!isToughType(s.storyType) || seen.has(s.storyType!)) return [];
    const answer = s.content.draft?.parts.answer?.trim();
    const question = getToughQuestion(s.storyType);
    if (!answer || !question) return [];
    seen.add(s.storyType!);
    return [{ id: s.id, question: question.label, answer, href: storyHref(s) }];
  });
}

// The one-minute warm-up: About me, three numbers, then the top questions with their stories, one
// card at a time, to read or say out loud.
export type WarmUpCard =
  | { kind: "intro"; intro: BriefIntro }
  | { kind: "numbers"; numbers: BriefNumber[] }
  | { kind: "question"; index: number; question: BriefQuestion };

export function warmUpCards(brief: Brief): WarmUpCard[] {
  const cards: WarmUpCard[] = [];
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

// Questions worth asking at the end of any interview, until the brief has ones tailored to each
// job (PRD P1, "Questions to ask the interviewer").
export const STARTER_QUESTIONS = [
  "What would success look like in the first 90 days?",
  "What's the biggest challenge the team is facing right now?",
  "How does the team decide what to work on next?",
  "What do the people who do best here have in common?",
  "What are the next steps, and is there anything you'd like me to expand on?",
] as const;

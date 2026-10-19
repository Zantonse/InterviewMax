// The tough-questions coach (PRD v0.3, P0): the awkward questions people dread more than the STAR
// ones. Each has a few plain questions about the user's real situation, then one call writes a
// short answer from them (see prompts.ts). Answers live in the story bank as their own story type,
// "tough_<id>", so practice mode and the pre-interview brief can read them like any other story.
// No model call here.

export type ToughPrompt = {
  id: string;
  text: string;
  // A hint under the box, e.g. what's enough to say.
  hint?: string;
  optional?: boolean;
};

export type ToughQuestion = {
  id: string;
  // The question as an interviewer asks it.
  label: string;
  blurb: string;
  prompts: readonly ToughPrompt[];
  // What a good answer does for this question, given to the writer and shown on the page.
  approach: string;
};

export const TOUGH_QUESTIONS = [
  {
    id: "why_leaving",
    label: "Why are you leaving?",
    blurb: "Or why you left. A reason that looks forward, not back.",
    approach:
      "One honest reason, said without complaint, then what you want next and why this role has it.",
    prompts: [
      {
        id: "status",
        text: "Are you still in your current job, or have you already left? If you left, roughly when?",
      },
      {
        id: "reason",
        text: "What's the real reason you're looking? Say it plainly here, even if it's not flattering. I'll help you put it fairly.",
        hint: "For example: no room to grow, a reorg, pay, a manager, the commute, the work changed.",
      },
      {
        id: "want",
        text: "What are you looking for next that you don't have now?",
      },
      {
        id: "good",
        text: "What's one thing you've valued about your current or last job?",
        optional: true,
        hint: "Saying something good about where you are keeps the answer from sounding bitter.",
      },
    ],
  },
  {
    id: "gap",
    label: "Can you explain this gap?",
    blurb: "Time out of work, for any reason. Said plainly, without apology.",
    approach:
      "Name the gap and its reason in a sentence, mention anything you did in it, then say you're ready and why this role.",
    prompts: [
      {
        id: "when",
        text: "When was the gap, and about how long was it?",
      },
      {
        id: "why",
        text: "What was it for? Share only what you're comfortable saying in an interview.",
        hint: "Caring for family, health, a layoff and a long search, travel, study, a business of your own. You never have to give medical or family details.",
      },
      {
        id: "did",
        text: "What did you do during it that's worth mentioning? Courses, projects, volunteering, freelance work, anything that kept you sharp.",
        optional: true,
      },
      {
        id: "ready",
        text: "What's changed so you're ready to work now, and why this kind of role?",
      },
    ],
  },
  {
    id: "let_go",
    label: "Why were you laid off or let go?",
    blurb: "A layoff or a firing. Brief, true, and then on to what's next.",
    approach:
      "Say what happened in one sentence. For a layoff, the wider cut. For a firing, own your part, say what you changed, and move on.",
    prompts: [
      {
        id: "what",
        text: "Was it a layoff (your role was cut) or were you let go for performance or fit?",
      },
      {
        id: "context",
        text: "What happened? Was it part of a wider cut? If you were let go, what was your part in it, honestly?",
        hint: "For a layoff: how many people or which teams, if you know. For a firing: what didn't work.",
      },
      {
        id: "learned",
        text: "What have you learned or done differently since?",
      },
      {
        id: "proof",
        text: "Is there a result from that job you're proud of, despite how it ended?",
        optional: true,
      },
    ],
  },
  {
    id: "many_moves",
    label: "Why so many moves?",
    blurb: "Several short stints on your resume. A thread that ties them together.",
    approach:
      "Give the honest reason for the moves in a line, show the thread that connects them, and say why this role is one you'd stay in.",
    prompts: [
      {
        id: "moves",
        text: "Which moves will an interviewer ask about? List them with the real reason for each, briefly.",
        hint: "For example: acquired, startup ran out of money, contract ended, chased a bigger role.",
      },
      {
        id: "thread",
        text: "What's the common thread? What were you building toward across them?",
      },
      {
        id: "stay",
        text: "What would make you stay somewhere for years, and why does this kind of role have it?",
      },
    ],
  },
  {
    id: "weakness",
    label: "What's your greatest weakness?",
    blurb: "A real one, with what you're doing about it. Not \"I'm a perfectionist\".",
    approach:
      "A real weakness that won't sink you for this role, one short example of it, and what you do about it now, with proof it's working.",
    prompts: [
      {
        id: "weakness",
        text: "What's a real weakness of yours at work? Something a manager or colleague has pointed out is a good start.",
      },
      {
        id: "example",
        text: "When did it show up? One short example.",
      },
      {
        id: "doing",
        text: "What do you do about it now, and what's changed since you started?",
      },
    ],
  },
  {
    id: "failure",
    label: "Tell me about a failure.",
    blurb: "The short version: what went wrong, your part, what changed.",
    approach:
      "What went wrong and your part in it, without blaming others, what you did next, and the one thing you do differently now.",
    prompts: [
      {
        id: "what",
        text: "What went wrong? Pick something that really mattered, not a near miss.",
      },
      {
        id: "part",
        text: "What was your part in it? What did you get wrong yourself?",
      },
      {
        id: "after",
        text: "What did you do once it went wrong?",
      },
      {
        id: "changed",
        text: "What do you do differently now because of it?",
      },
    ],
  },
  {
    id: "salary",
    label: "What are your salary expectations?",
    blurb: "A script for the question itself. Not negotiation.",
    approach:
      "A calm, rehearsed line: a researched range or a polite ask for theirs first, and that the whole package matters.",
    prompts: [
      {
        id: "range",
        text: "What range are you aiming for, and is that base salary or total pay? Leave it blank if you don't have one yet.",
        optional: true,
        hint: "Only figures you give here go in the script.",
      },
      {
        id: "basis",
        text: "Where does that range come from? Market research, your current pay, an offer, a recruiter?",
        optional: true,
      },
      {
        id: "first",
        text: "Would you rather give a number first, or ask for their range first?",
      },
      {
        id: "matters",
        text: "Besides pay, what matters to you in an offer? Equity, bonus, remote work, title, start date?",
        optional: true,
      },
    ],
  },
] as const satisfies readonly ToughQuestion[];

export type ToughQuestionId = (typeof TOUGH_QUESTIONS)[number]["id"];

const TYPE_PREFIX = "tough_";

export function toughStoryType(id: ToughQuestionId): string {
  return `${TYPE_PREFIX}${id}`;
}

export function isToughType(storyType: string | null | undefined): boolean {
  return Boolean(storyType?.startsWith(TYPE_PREFIX));
}

export function getToughQuestion(
  idOrStoryType: string | null | undefined,
): (typeof TOUGH_QUESTIONS)[number] | undefined {
  const id = idOrStoryType?.startsWith(TYPE_PREFIX)
    ? idOrStoryType.slice(TYPE_PREFIX.length)
    : idOrStoryType;
  return TOUGH_QUESTIONS.find((q) => q.id === id);
}

// The tough question a real interviewer's question is, when it's one (a recruiter's "do you have
// a number you're targeting?" is the salary question). Used on past interviews, where these come
// back as "other" questions with no story to link to. Checked in order: most specific first.
const ASKED_AS: { id: ToughQuestionId; pattern: RegExp }[] = [
  { id: "let_go", pattern: /\b(?:laid off|layoffs?|let go|were you fired)\b/i },
  { id: "gap", pattern: /\b(?:gap in|gap on your|employment gap|since you left|time off between)\b/i },
  {
    id: "salary",
    pattern:
      /\b(?:salary|compensation|comp band|pay range|base pay|number (?:you're |you are )?(?:trying to )?target|what (?:are you|do you) (?:looking for|expect) (?:in|for) pay)\b/i,
  },
  {
    id: "why_leaving",
    pattern:
      /\b(?:why (?:are|were|did) you (?:leaving|looking|leave)|why do you want to leave|looking to make a move|why are you on the market)\b/i,
  },
  { id: "many_moves", pattern: /\b(?:so many (?:moves|jobs|roles)|job[- ]hopp)/i },
  { id: "weakness", pattern: /\bweakness(?:es)?\b/i },
];

export function toughForAsked(question: string): ToughQuestionId | undefined {
  return ASKED_AS.find((a) => a.pattern.test(question))?.id;
}

// Where a story in the bank opens: tough answers have their own page.
export function storyHref(story: { id: string; storyType: string | null }): string {
  return isToughType(story.storyType) ? `/tough-questions/${story.id}` : `/stories/${story.id}`;
}

// The prompts that must be answered before the answer can be written.
export function missingPrompts(question: ToughQuestion, answers: Record<string, string>): string[] {
  return question.prompts
    .filter((p) => !("optional" in p && p.optional) && !answers[p.id]?.trim())
    .map((p) => p.id);
}

// 20 to 40 seconds spoken, at about 150 words a minute. The max is a hard limit: a longer answer is
// sent back to be cut.
export const TOUGH_LENGTH = { min: 50, max: 100 };

export const MAX_TOUGH_ANSWER_LENGTH = 2000;
export const MAX_EDITED_ANSWER_LENGTH = 1200;

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

// Rough speaking time in seconds, at 150 words a minute.
export function speakingSeconds(text: string): number {
  return Math.round((wordCount(text) / 150) * 60);
}

// What's wrong with a written answer, as instructions for a rewrite. Empty when it passes.
export function checkAnswer(answer: { answer: string; untracedNumbers: string[] }): string[] {
  const problems: string[] = [];
  if (answer.untracedNumbers.length > 0) {
    problems.push(
      `It uses numbers the user never gave (${answer.untracedNumbers.join(", ")}). Remove them or use only their figures.`,
    );
  }
  const words = wordCount(answer.answer);
  if (words > TOUGH_LENGTH.max) {
    problems.push(`It is ${words} words. Cut it to under ${TOUGH_LENGTH.max}.`);
  }
  return problems;
}

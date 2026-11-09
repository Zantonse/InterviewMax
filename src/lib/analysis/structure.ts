import { countWords } from "@/lib/stories/grading";
import { INTRO_LENGTH, STAR_LENGTH, type StoryType } from "@/lib/stories/story-types";

// The high-level half of "Why it works": why an interview answer is built in these parts, why each
// part is there, and why it is about this long. Plain code, the same for every story of a format,
// so it shows straight away and never depends on a model. The story-specific notes (analyze.ts)
// sit under it.

export type ShareRange = { min: number; max: number };

export type PartGuide = {
  // What this part does for the interviewer, and where it sits in how they listen and score.
  why: string;
  // The share of the story's words this part usually takes.
  share: ShareRange;
  // Why it's about that long.
  lengthWhy: string;
};

export type FormatGuide = {
  // How the whole answer is built, in a few sentences.
  overview: string;
  // How long the whole answer should take to say, in words at about 150 a minute.
  words: ShareRange;
  spoken: string;
  parts: Record<string, PartGuide>;
};

const STAR: FormatGuide = {
  overview:
    'Behavioral questions ("Tell me about a time…") are how interviewers check a skill by asking for proof from your past. Most score your answer against a short list: was the situation real and hard, what did you personally do, how did you think, what changed because of it, and what did you take from it. This story is built in that order so the interviewer can follow it the first time and tick each box as they listen.',
  // The same length the writer and grader aim for.
  words: STAR_LENGTH,
  spoken: "about 1 to 2 minutes",
  parts: {
    situation: {
      why: "Gives the interviewer just enough context to care: what was going on and what was at stake. Without stakes, nothing that follows sounds hard, so your actions can't impress.",
      share: { min: 0.1, max: 0.22 },
      lengthWhy:
        "Kept short on purpose. Interviewers want to get to what you did; a long setup is the most common reason answers run over and lose them.",
    },
    role: {
      why: "Tells them what was yours. Interviewers are hiring you, not your team, so they listen for where your part starts and ends before they judge your actions.",
      share: { min: 0.05, max: 0.15 },
      lengthWhy:
        "One or two sentences is enough. Its job is to frame the next part, not to be a story of its own.",
    },
    actions: {
      why: "This is what they're really scoring: what you did and how you thought at the key moment. It's where they decide whether you have the skill the question is about.",
      share: { min: 0.4, max: 0.6 },
      lengthWhy:
        "The longest part on purpose, about half the story. Spend your time where the score is.",
    },
    result: {
      why: 'Proves your actions worked. A clear outcome, ideally with a number, turns "I did things" into "I made something better", and it\'s what they\'ll remember and write down.',
      share: { min: 0.1, max: 0.25 },
      lengthWhy:
        "Short and plain. One or two sentences with the number land harder than a paragraph of outcomes.",
    },
    reflection: {
      why: 'Shows self-awareness and that you\'d bring the lesson to their team. Many rubrics have a box for "learns and grows", and this is the only part that fills it.',
      share: { min: 0.05, max: 0.15 },
      lengthWhy:
        "One or two sentences to close. It's the last thing they hear, so it should be crisp, not a second story.",
    },
  },
};

const INTRO: FormatGuide = {
  overview:
    '"Tell me about yourself" opens almost every interview. The interviewer is deciding where to steer the next 45 minutes, so this answer is a short guided tour: who you are now, how you got here, one result that proves it, what you\'re known for, and why this role is the next step. Told in that order, it ends by handing them a reason to hire you.',
  words: INTRO_LENGTH,
  spoken: "about 1 to 1½ minutes",
  parts: {
    present: {
      why: "Starts with today so they can place you straight away: your role, your scope, the size of what you own.",
      share: { min: 0.15, max: 0.3 },
      lengthWhy: "A sentence or two. It's the anchor, not the story.",
    },
    path: {
      why: "Connects the dots so your career reads as a direction, not a list of jobs. It answers the question behind the question: why should this make sense?",
      share: { min: 0.15, max: 0.3 },
      lengthWhy:
        "Brief: pick the moves that explain where you're going and skip the rest. They have your resume.",
    },
    highlight: {
      why: "One concrete result is proof that the summary is true. It's also the hook they're most likely to ask about next, so you're choosing your own follow-up.",
      share: { min: 0.2, max: 0.35 },
      lengthWhy: "The biggest part, because it's the only evidence in the answer.",
    },
    strengths: {
      why: "Tells them what you'd be known for on their team, in words they can repeat in the debrief.",
      share: { min: 0.1, max: 0.25 },
      lengthWhy: "Short: two or three strengths, not a list.",
    },
    next: {
      why: "Ends on why this role, so the tour lands on them. Interviewers check motivation early; this answers it before they ask.",
      share: { min: 0.1, max: 0.25 },
      lengthWhy:
        "One or two sentences, and the last thing they hear before they start asking questions.",
    },
  },
};

export function formatGuide(storyType: StoryType | undefined): FormatGuide {
  return storyType?.format === "intro" ? INTRO : STAR;
}

export type LengthCheck = {
  share: number;
  verdict: "short" | "fits" | "long";
  // One line saying where this part sits against its usual share.
  note: string;
};

// How much of the story this part takes, against its usual share.
export function partLength(text: string, totalWords: number, guide: PartGuide): LengthCheck {
  const share = totalWords > 0 ? countWords(text) / totalWords : 0;
  const pct = Math.round(share * 100);
  const range = `${Math.round(guide.share.min * 100)}–${Math.round(guide.share.max * 100)}%`;
  if (share > guide.share.max) {
    return {
      share,
      verdict: "long",
      note: `${pct}% of your story; usually ${range}. Worth trimming.`,
    };
  }
  if (share < guide.share.min) {
    return {
      share,
      verdict: "short",
      note: `${pct}% of your story; usually ${range}. Could say a bit more.`,
    };
  }
  return {
    share,
    verdict: "fits",
    note: `${pct}% of your story, right in the usual ${range}.`,
  };
}

// How the whole story's length compares with how long the answer should take to say.
export function totalLength(
  totalWords: number,
  guide: FormatGuide,
): { verdict: LengthCheck["verdict"]; note: string } {
  const say = `Aim for ${guide.words.min}–${guide.words.max} words, ${guide.spoken} spoken: long enough to show depth, short enough that they can still ask follow-ups.`;
  if (totalWords > guide.words.max)
    return {
      verdict: "long",
      note: `Yours is ${totalWords} words, a bit long. ${say}`,
    };
  if (totalWords < guide.words.min)
    return {
      verdict: "short",
      note: `Yours is ${totalWords} words, on the short side. ${say}`,
    };
  return {
    verdict: "fits",
    note: `Yours is ${totalWords} words, a good length. ${say}`,
  };
}

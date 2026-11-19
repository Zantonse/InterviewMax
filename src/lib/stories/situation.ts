import {
  type FieldId,
  fieldJoggers,
  fieldScopeHint,
  fieldStakes,
  fieldWins,
} from "@/lib/field/fields";
import { type StoryType, type StoryTypeId, coreQuestionText } from "./story-types";

// The user's situation, so the builder's own questions fit them instead of a generic mid-career
// professional (Craig, Nov 16, after an IC was asked for a team, territory or budget he doesn't
// have). Read in code from what the app already knows, never a model call:
//   field: "Your field" in Settings;
//   entry: their open target jobs are entry level;
//   managesPeople: what their About me "where you are now" answer says (null when it says nothing);
//   toManager: a target job manages people and nothing they've said shows they do yet.
// It changes how questions are worded, which examples and taps are shown, and one block of the
// follow-up instructions. It never changes facts, scores or which gaps get flagged.
//
// Plain code, safe to import in client components.

export type Situation = {
  field: FieldId | null;
  entry: boolean;
  managesPeople: boolean | null;
  toManager: boolean;
};

export const NO_SITUATION: Situation = {
  field: null,
  entry: false,
  managesPeople: null,
  toManager: false,
};

// Words that say they manage people now. Kept narrow on purpose: "I lead the governance program"
// or "I'm a product manager" is not managing people.
const MANAGES_RE = new RegExp(
  [
    String.raw`\b(direct reports|my reports|reports to me|people manager)\b`,
    String.raw`\bi (manage|lead|run|head|built and lead) (a |the |my |our )?(\w+ ){0,2}(team|group|org|organization|department)\b(?!')`,
    String.raw`\bmanag(e|es|ing) (a |the |my )?(team|group|org|department)\b`,
    String.raw`\bi manage \d+`,
    String.raw`\bi('m| am) (an? |the )?(engineering |data |design |sales |analytics |support |finance |people )?(manager|director|head of|vp)\b`,
  ].join("|"),
  "i",
);

export function managesPeopleFrom(text: string | null | undefined): boolean | null {
  const t = text?.trim();
  if (!t) return null;
  return MANAGES_RE.test(t);
}

// Titles that usually manage people. "Product manager", "account manager" and the like don't.
const MANAGER_TITLE_RE = /\b(manager|director|head of|vp|vice president|team lead)\b/i;
const NOT_PEOPLE_MANAGER_RE =
  /\b(product|account|program|project|customer success|success|client|case|community|marketing|partner|territory|relationship|key account|technical account|portfolio|release|content|social media|office|property|brand)\s+manager\b/i;

export function managesPeopleTitle(title: string): boolean {
  return MANAGER_TITLE_RE.test(title) && !NOT_PEOPLE_MANAGER_RE.test(title);
}

export function situationFor(input: {
  field?: FieldId | null;
  // Open target jobs, nearest first.
  jobs?: { title: string; level: string | null }[];
  // Their About me answer to "where you are now".
  currentRole?: string | null;
}): Situation {
  const jobs = input.jobs ?? [];
  const managesPeople = managesPeopleFrom(input.currentRole);
  // Entry level when every open job with a level is entry level.
  const levels = jobs.map((j) => j.level).filter(Boolean);
  const entry = levels.length > 0 && levels.every((l) => l === "entry");
  const toManager =
    !entry && managesPeople === false && jobs.some((j) => managesPeopleTitle(j.title));
  return { field: input.field ?? null, entry, managesPeople, toManager };
}

// --- The scripted questions ---------------------------------------------------------------------

const ENTRY_INTRO: Record<string, string> = {
  now: "Let's start with today. What are you doing right now: studying, an internship, a first job or something else? What do you work on, and who relies on it?",
  path: "What got you into this field: a class, a project, a job or a person? What made you choose it?",
  highlight:
    "What's one thing you've done that you're most proud of, from school, an internship, a job or a project? What did you do, and how did it turn out? A number helps if you have one (people who used it, time it saved, a grade), and an estimate is fine.",
  known_for:
    "What do classmates, teammates or a manager come to you for? Think of the last time someone asked for your help: what was it, and what did you do?",
};

const ENTRY_TELLING =
  " It can be from school, an internship, a part-time job, volunteering or a side project.";

// The question the builder shows for one scripted question, fitted to the user's situation. The
// coach and writer still read the base wording (coreQuestionText); this only words it for them.
export function questionFor(
  questionId: string,
  storyType: StoryType | undefined,
  asked: string | undefined,
  situation: Situation,
): string {
  if (storyType?.format === "intro") {
    if (situation.entry && ENTRY_INTRO[questionId]) return ENTRY_INTRO[questionId];
    if (questionId === "now") {
      return coreQuestionText(questionId, storyType, asked, fieldScopeHint(situation.field));
    }
    const base = coreQuestionText(questionId, storyType, asked);
    if (questionId === "highlight") {
      const wins = fieldWins(situation.field);
      return wins ? `${base} In your field, that might be ${wins}.` : base;
    }
    return base;
  }
  const base = coreQuestionText(questionId, storyType, asked);
  if (questionId === "start" && situation.entry) return `${base}${ENTRY_TELLING}`;
  return base;
}

// --- Memory joggers and Quick start -------------------------------------------------------------

// For entry-level candidates: the story types' default joggers assume years of work (customers won,
// quarters, launches led), and simulated junior users stalled on them (2026-11-08).
const ENTRY_JOGGERS: Partial<Record<StoryTypeId, readonly string[]>> = {
  major_project: [
    "A class or capstone project you led",
    "An internship project you owned",
    "Something you built on your own",
    "An event or club project you ran",
  ],
  difficult_stakeholder: [
    "A group member who didn't pull their weight",
    "A manager or professor who disagreed with you",
    "A customer or member of the public who was upset",
    "A teammate with a different plan",
  ],
  went_wrong: [
    "A deadline you missed",
    "A project that didn't work the first time",
    "A mistake at a job or internship",
    "A plan you had to change halfway",
  ],
  prioritization: [
    "Exams and a job at the same time",
    "Two deadlines in the same week",
    "Too many shifts or tasks at once",
    "Something you chose to drop",
  ],
  cross_team: [
    "A group project with people you didn't know",
    "Working with another team at an internship",
    "A club or volunteer project with several groups",
    "Getting help from someone outside your team",
  ],
  defining_success: [
    "A goal you set for yourself and hit",
    "Feedback that told you it went well",
    "A project you'd show an interviewer first",
    "Something you improved on your own",
  ],
  ai_use: [
    "A paper or project where you checked AI's work",
    "Code or analysis you sped up with AI",
    "A time AI got something wrong and you caught it",
    "A tool you set up for yourself or a team",
  ],
};

// Entry level first, then their field's own, then the story type's defaults.
export function joggersFor(
  storyType: StoryType | undefined,
  situation: Situation,
): readonly string[] {
  if (!storyType) return [];
  if (situation.entry && ENTRY_JOGGERS[storyType.id]) return ENTRY_JOGGERS[storyType.id]!;
  return fieldJoggers(situation.field, storyType.id) ?? storyType.joggers ?? [];
}

const ENTRY_STAKES = ["A grade or project", "A deadline", "My team", "Someone relying on me"] as const;

// The "At stake" taps: entry level, then their field's, else the defaults (see quick-start.ts).
export function stakesFor(situation: Situation): readonly string[] | undefined {
  if (situation.entry) return ENTRY_STAKES;
  return fieldStakes(situation.field);
}

// "My part" taps for someone who manages people: what the manager did is the story.
export const MANAGER_PART = ["I led the team", "I owned one piece", "I stepped in unasked"] as const;

export function partsFor(situation: Situation): readonly string[] | undefined {
  return situation.managesPeople ? MANAGER_PART : undefined;
}

// --- The follow-up coach ------------------------------------------------------------------------

// Who the coach is helping, in its first line.
export function audienceFor(situation: Situation | undefined): string {
  return situation?.entry
    ? "someone early in their career (school, internships, a first job)"
    : "an experienced professional";
}

// Added to the follow-up instructions. Empty when nothing is known.
export function situationRules(situation: Situation | undefined): string {
  if (!situation) return "";
  const lines: string[] = [];
  if (situation.entry) {
    lines.push(
      "They're early in their career. Stories from school, internships, part-time jobs, volunteering and side projects count as much as work. Never ask for a team, budget, revenue or customers they haven't mentioned; ask what they did themselves, who relied on it, and what they learned. Keep numbers small and real (people who used it, hours saved, a grade).",
    );
  } else if (situation.managesPeople === true) {
    lines.push(
      "They manage people. Draw out what they did as the manager, not only what the team did: how they set direction, split the work, coached or backed someone, and the call that was theirs to make.",
    );
  } else if (situation.managesPeople === false) {
    lines.push(
      "They're an individual contributor. Their scope is what they own and who relies on it, and their influence is how they moved people they don't manage. Ask about those, never about a team or budget they don't have.",
    );
  }
  if (situation.toManager) {
    lines.push(
      "Their target jobs manage people, and nothing they've said shows they do yet. Where the story has a moment of leading others without the title (mentoring someone, running a project, getting a team to adopt something), ask about it once, lightly. Never imply they managed people.",
    );
  }
  return lines.length ? `About this person:\n${lines.map((l) => `- ${l}`).join("\n")}` : "";
}

// The situation for one story, from what the builder has: in "Tell me about yourself" the "where
// you are now" answer is in the story itself; elsewhere it comes from their About me (targets).
export function storySituation(
  content: { answers: Record<string, string | undefined> },
  storyType: StoryType | undefined,
  targets: { jobs: { title: string; level: string | null }[]; currentRole?: string } | undefined,
  field: FieldId | null = null,
): Situation {
  return situationFor({
    field,
    jobs: targets?.jobs,
    currentRole: storyType?.format === "intro" ? content.answers.now : targets?.currentRole,
  });
}

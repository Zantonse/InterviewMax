import { type RoleMap, parseRoleMap, roleAnswerText } from "@/lib/roles/role-map";
import { parseStoredGrade, type StoryGrade } from "./grading";
import { coreQuestions, type StoryType } from "./story-types";

// What the builder keeps in stories.content (jsonb).
export type FollowUp = {
  question: string;
  // Which part of the checklist the question is aimed at, e.g. "result".
  gap: string;
  answer?: string;
  // Which review round asked it (1 or 2). Missing on stories from before there were two rounds.
  round?: number;
  // "practice" when the user added it from a practice answer (see src/lib/practice): the question
  // is the one they practiced, and the answer is what they said, confirmed by them.
  source?: "practice";
};

// The review asks follow-ups in up to two rounds: the first always asks, the second only when the
// answers are still thin.
export const MAX_PROBE_ROUNDS = 2;

// Once a story is drafted, "Ask me more to make it stronger" runs further rounds on request, up to
// this many rounds in all (a backstop, not a target).
export const MAX_STRENGTHEN_ROUNDS = 10;

export type StoryDraft = {
  // Keyed by the story type's part ids (see storyParts).
  parts: Record<string, string>;
  // Numbers in the draft that don't appear anywhere in the user's answers. Should be empty.
  untracedNumbers: string[];
  model: string;
  writtenAt: string;
};

// An answer the user prepared before and uploaded, used in place of the scripted questions.
export type ImportedAnswer = {
  fileName: string;
  text: string;
};

// A LinkedIn profile the user uploaded as PDF. Its text counts as their own words for the number
// check; `prefilled` lists the core questions answered from it.
export type LinkedInProfile = {
  fileName: string;
  text: string;
  prefilled: string[];
};

// "Tell me about yourself" only: the career path read from a resume or LinkedIn profile, shown back
// for the user to confirm as their answer to "path" instead of asking them to list their moves.
export type InferredPath = {
  text: string;
  source: "resume" | "linkedin";
};

// "Tell me about yourself" for one target job: why this company, in the user's words, and the
// three-beat answer written from it.
export type TailoredIntro = {
  whyCompany: string;
  draft?: TailoredDraft;
};

export type TailoredDraft = {
  // Keyed by TAILORED_PARTS ids.
  parts: Record<string, string>;
  // One line on the angle the writer chose for this job.
  angle: string;
  untracedNumbers: string[];
  model: string;
  writtenAt: string;
};

// A moment picked in the story finder (src/lib/finder). A suggestion only: it fills in the first
// answer for the user to edit, and counts as their words once they save that answer.
export type StorySeed = {
  moment: string;
  question: string;
  quote: string;
  // Where the quote came from, e.g. "your resume".
  sourceLabel: string;
};

// Tough-questions coach only (src/lib/tough): which target job the answer turns toward, the coach's
// note on it, and whether the user has edited the written answer (kept in draft.parts.answer).
export type ToughMeta = {
  jobId?: string;
  note?: string;
  edited?: boolean;
};

export type StoryContent = {
  version: 1;
  tough?: ToughMeta;
  seed?: StorySeed;
  // Keyed by the story type's core question ids (see coreQuestions).
  answers: Record<string, string>;
  imported?: ImportedAnswer;
  linkedin?: LinkedInProfile;
  // "Tell me about yourself" only: the user's map of their role (see src/lib/roles).
  roleMap?: RoleMap;
  inferredPath?: InferredPath;
  // "Tell me about yourself" only: versions for each target job, keyed by job id.
  tailored?: Record<string, TailoredIntro>;
  followUps?: FollowUp[];
  // Set when the review has nothing more to ask, or ran out of rounds.
  probeDone?: boolean;
  // Set when the last round asked for found nothing more to ask; cleared when an answer changes.
  nothingMoreToAsk?: boolean;
  draft?: StoryDraft;
  // The latest grade of the draft (see grading.ts). Stale once the draft is rewritten.
  grade?: StoryGrade;
};

// Where the user is in the builder, derived from what has been saved.
//  core:       answering the scripted questions (skipped when a prepared answer was uploaded)
//  probe:      all answered; call one (follow-ups) hasn't run yet, or a further round is due
//  follow_ups: answering the model's follow-up questions
//  write:      everything answered; call two (write the story) hasn't run yet
//  drafted:    a written draft exists
export type BuilderStage = "core" | "probe" | "follow_ups" | "write" | "drafted";

export function emptyContent(): StoryContent {
  return { version: 1, answers: {} };
}

export function nextCoreQuestion(
  content: StoryContent,
  storyType: StoryType | undefined,
): string | undefined {
  return coreQuestions(storyType).find((q) => !content.answers[q.id]?.trim())?.id;
}

export function nextFollowUpIndex(content: StoryContent): number | undefined {
  const i = content.followUps?.findIndex((f) => !f.answer?.trim()) ?? -1;
  return i >= 0 ? i : undefined;
}

export function probeRounds(content: StoryContent): number {
  return Math.max(0, ...(content.followUps ?? []).map((f) => f.round ?? 1));
}

// Whether the review can run another round of follow-ups.
export function canProbeAgain(content: StoryContent): boolean {
  return !content.probeDone && probeRounds(content) < MAX_PROBE_ROUNDS;
}

// Whether a drafted story can be sent back for another round of questions.
export function canStrengthen(content: StoryContent): boolean {
  return Boolean(content.draft) && probeRounds(content) < MAX_STRENGTHEN_ROUNDS;
}

export function builderStage(
  content: StoryContent,
  storyType: StoryType | undefined,
): BuilderStage {
  if (!content.imported && nextCoreQuestion(content, storyType)) return "core";
  if (!content.followUps) return "probe";
  if (nextFollowUpIndex(content) !== undefined) return "follow_ups";
  if (content.draft) return "drafted";
  if (canProbeAgain(content)) return "probe";
  return "write";
}

// Whether the story has a written draft. This is what "Draft written" means everywhere outside the
// builder: a story keeps it while the user answers another round of "make it stronger" questions.
export function hasDraft(content: StoryContent): boolean {
  return Boolean(content.draft);
}

// Every answer the user has typed, as one block of text. Numbers in a draft must trace back to this.
export function allAnswerText(content: StoryContent): string {
  return [
    content.imported?.text ?? "",
    content.linkedin?.text ?? "",
    roleAnswerText(content.roleMap),
    ...Object.values(content.answers),
    ...(content.followUps ?? []).map((f) => f.answer ?? ""),
  ]
    .filter(Boolean)
    .join("\n");
}

// Reads stories.content defensively: it is jsonb, so its shape isn't guaranteed. Answers and draft
// parts are kept by key whatever the story type; the builder only reads the keys its type uses.
export function parseContent(raw: unknown): StoryContent {
  const content = emptyContent();
  if (!isRecord(raw)) return content;

  if (isRecord(raw.answers)) {
    content.answers = stringEntries(raw.answers);
  }

  if (isRecord(raw.imported) && typeof raw.imported.text === "string" && raw.imported.text) {
    content.imported = {
      fileName: typeof raw.imported.fileName === "string" ? raw.imported.fileName : "",
      text: raw.imported.text,
    };
  }

  if (isRecord(raw.linkedin) && typeof raw.linkedin.text === "string" && raw.linkedin.text) {
    content.linkedin = {
      fileName: typeof raw.linkedin.fileName === "string" ? raw.linkedin.fileName : "",
      text: raw.linkedin.text,
      prefilled: Array.isArray(raw.linkedin.prefilled)
        ? raw.linkedin.prefilled.filter((id): id is string => typeof id === "string")
        : [],
    };
  }

  if (Array.isArray(raw.followUps)) {
    content.followUps = raw.followUps.filter(isRecord).flatMap((f) =>
      typeof f.question === "string"
        ? [
            {
              question: f.question,
              gap: typeof f.gap === "string" ? f.gap : "",
              ...(typeof f.answer === "string" ? { answer: f.answer } : {}),
              ...(typeof f.round === "number" ? { round: f.round } : {}),
              ...(f.source === "practice" ? { source: "practice" as const } : {}),
            },
          ]
        : [],
    );
  }

  if (
    isRecord(raw.inferredPath) &&
    typeof raw.inferredPath.text === "string" &&
    (raw.inferredPath.source === "resume" || raw.inferredPath.source === "linkedin")
  ) {
    content.inferredPath = { text: raw.inferredPath.text, source: raw.inferredPath.source };
  }

  if (isRecord(raw.tailored)) {
    const tailored: Record<string, TailoredIntro> = {};
    for (const [jobId, t] of Object.entries(raw.tailored)) {
      if (!isRecord(t) || typeof t.whyCompany !== "string") continue;
      tailored[jobId] = { whyCompany: t.whyCompany };
      if (isRecord(t.draft) && isRecord(t.draft.parts)) {
        tailored[jobId].draft = {
          parts: stringEntries(t.draft.parts),
          angle: typeof t.draft.angle === "string" ? t.draft.angle : "",
          untracedNumbers: Array.isArray(t.draft.untracedNumbers)
            ? t.draft.untracedNumbers.filter((n): n is string => typeof n === "string")
            : [],
          model: typeof t.draft.model === "string" ? t.draft.model : "",
          writtenAt: typeof t.draft.writtenAt === "string" ? t.draft.writtenAt : "",
        };
      }
    }
    if (Object.keys(tailored).length > 0) content.tailored = tailored;
  }

  if (isRecord(raw.seed) && typeof raw.seed.moment === "string" && raw.seed.moment) {
    content.seed = {
      moment: raw.seed.moment,
      question: typeof raw.seed.question === "string" ? raw.seed.question : "",
      quote: typeof raw.seed.quote === "string" ? raw.seed.quote : "",
      sourceLabel: typeof raw.seed.sourceLabel === "string" ? raw.seed.sourceLabel : "",
    };
  }

  const roleMap = parseRoleMap(raw.roleMap);
  if (roleMap) content.roleMap = roleMap;

  if (raw.probeDone === true) content.probeDone = true;
  if (raw.nothingMoreToAsk === true) content.nothingMoreToAsk = true;

  if (isRecord(raw.draft) && isRecord(raw.draft.parts)) {
    content.draft = {
      parts: stringEntries(raw.draft.parts),
      untracedNumbers: Array.isArray(raw.draft.untracedNumbers)
        ? raw.draft.untracedNumbers.filter((n): n is string => typeof n === "string")
        : [],
      model: typeof raw.draft.model === "string" ? raw.draft.model : "",
      writtenAt: typeof raw.draft.writtenAt === "string" ? raw.draft.writtenAt : "",
    };
  }

  if (isRecord(raw.tough)) {
    content.tough = {
      ...(typeof raw.tough.jobId === "string" ? { jobId: raw.tough.jobId } : {}),
      ...(typeof raw.tough.note === "string" ? { note: raw.tough.note } : {}),
      ...(raw.tough.edited === true ? { edited: true } : {}),
    };
  }

  const grade = parseStoredGrade(raw.grade);
  if (grade) content.grade = grade;

  return content;
}

// Whether the saved grade is for the current draft.
export function gradeIsCurrent(content: StoryContent): boolean {
  return Boolean(content.draft && content.grade?.draftWrittenAt === content.draft.writtenAt);
}

function stringEntries(record: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).filter((e): e is [string, string] => typeof e[1] === "string"),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import { CORE_QUESTIONS, STORY_PARTS, type CoreQuestionId, type StoryPartId } from "./story-types";

// What the builder keeps in stories.content (jsonb).
export type FollowUp = {
  question: string;
  // Which part of the checklist the question is aimed at, e.g. "result".
  gap: string;
  answer?: string;
};

export type StoryDraft = {
  parts: Record<StoryPartId, string>;
  // Numbers in the draft that don't appear anywhere in the user's answers. Should be empty.
  untracedNumbers: string[];
  model: string;
  writtenAt: string;
};

export type StoryContent = {
  version: 1;
  answers: Partial<Record<CoreQuestionId, string>>;
  followUps?: FollowUp[];
  draft?: StoryDraft;
};

// Where the user is in the builder, derived from what has been saved.
//  core:       answering the scripted questions
//  probe:      all scripted questions answered; call one (follow-ups) hasn't run yet
//  follow_ups: answering the model's follow-up questions
//  write:      everything answered; call two (write the story) hasn't run yet
//  drafted:    a written draft exists
export type BuilderStage = "core" | "probe" | "follow_ups" | "write" | "drafted";

export function emptyContent(): StoryContent {
  return { version: 1, answers: {} };
}

export function nextCoreQuestion(content: StoryContent): CoreQuestionId | undefined {
  return CORE_QUESTIONS.find((q) => !content.answers[q.id]?.trim())?.id;
}

export function nextFollowUpIndex(content: StoryContent): number | undefined {
  const i = content.followUps?.findIndex((f) => !f.answer?.trim()) ?? -1;
  return i >= 0 ? i : undefined;
}

export function builderStage(content: StoryContent): BuilderStage {
  if (nextCoreQuestion(content)) return "core";
  if (!content.followUps) return "probe";
  if (nextFollowUpIndex(content) !== undefined) return "follow_ups";
  if (!content.draft) return "write";
  return "drafted";
}

// Every answer the user has typed, as one block of text. Numbers in a draft must trace back to this.
export function allAnswerText(content: StoryContent): string {
  return [
    ...CORE_QUESTIONS.map((q) => content.answers[q.id] ?? ""),
    ...(content.followUps ?? []).map((f) => f.answer ?? ""),
  ]
    .filter(Boolean)
    .join("\n");
}

// Reads stories.content defensively: it is jsonb, so its shape isn't guaranteed.
export function parseContent(raw: unknown): StoryContent {
  const content = emptyContent();
  if (!isRecord(raw)) return content;

  if (isRecord(raw.answers)) {
    for (const q of CORE_QUESTIONS) {
      const value = raw.answers[q.id];
      if (typeof value === "string") content.answers[q.id] = value;
    }
  }

  if (Array.isArray(raw.followUps)) {
    content.followUps = raw.followUps.filter(isRecord).flatMap((f) =>
      typeof f.question === "string"
        ? [
            {
              question: f.question,
              gap: typeof f.gap === "string" ? f.gap : "",
              ...(typeof f.answer === "string" ? { answer: f.answer } : {}),
            },
          ]
        : [],
    );
  }

  if (isRecord(raw.draft) && isRecord(raw.draft.parts)) {
    const rawParts = raw.draft.parts;
    const parts = Object.fromEntries(
      STORY_PARTS.map((p) => [p.id, typeof rawParts[p.id] === "string" ? rawParts[p.id] : ""]),
    ) as Record<StoryPartId, string>;
    content.draft = {
      parts,
      untracedNumbers: Array.isArray(raw.draft.untracedNumbers)
        ? raw.draft.untracedNumbers.filter((n): n is string => typeof n === "string")
        : [],
      model: typeof raw.draft.model === "string" ? raw.draft.model : "",
      writtenAt: typeof raw.draft.writtenAt === "string" ? raw.draft.writtenAt : "",
    };
  }

  return content;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

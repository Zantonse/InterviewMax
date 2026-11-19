import type { StoryContent } from "./content";

// Level-up questions shown on the written story itself, under the paragraph they would improve
// (design comparison 2026-11-17, pattern 1: Grammarly marks the words that need work and fixes them
// in place). Plain code: each follow-up already says which gap it asks about, and each gap belongs
// to one part of the story, so no extra model call is needed to place it.

// Follow-up gap (GAPS in prompts.ts) -> the CARL part it adds to.
const GAP_PART: Record<string, string> = {
  situation: "situation",
  ownership: "actions",
  actions: "actions",
  obstacle: "actions",
  decision: "actions",
  result: "result",
  reflection: "reflection",
};

// What the question adds, in the words the level card uses.
const GAP_LABEL: Record<string, string> = {
  situation: "The stakes",
  ownership: "What you did yourself",
  actions: "What you did",
  obstacle: "What made it hard",
  decision: "Your thinking",
  result: "The result",
  reflection: "The lesson",
};

// Where a question goes when its part isn't in the story yet: after the last paragraph.
export const END_OF_STORY = "end";

export type InlineQuestion = {
  index: number;
  question: string;
  gap: string;
  label: string;
  // The part id whose paragraph it sits under, or END_OF_STORY.
  part: string;
  options?: string[];
};

// The open questions of the level-up round in progress, in the order they were asked. Empty when
// no level-up is waiting on answers.
export function inlineLevelQuestions(content: StoryContent): InlineQuestion[] {
  const levelUp = content.levelUp;
  const draft = content.draft;
  if (!levelUp || levelUp.reached !== undefined || levelUp.round === undefined || !draft) return [];
  return (content.followUps ?? []).flatMap((f, index) => {
    if ((f.round ?? 1) !== levelUp.round || f.answer?.trim() || f.skipped || f.source) return [];
    const mapped = GAP_PART[f.gap];
    const part = mapped && draft.parts[mapped]?.trim() ? mapped : END_OF_STORY;
    return [
      {
        index,
        question: f.question,
        gap: f.gap,
        label: GAP_LABEL[f.gap] ?? "Your story",
        part,
        ...(f.options?.length ? { options: f.options } : {}),
      },
    ];
  });
}

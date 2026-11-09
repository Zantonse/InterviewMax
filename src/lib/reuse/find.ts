import "server-only";
import { generateForStep } from "@/lib/ai";
import type { StoryContent } from "@/lib/stories/content";
import { draftText } from "@/lib/stories/grading";
import type { StoryType } from "@/lib/stories/story-types";
import type { Candidate, StoryAlsoAnswers } from "./content";
import { QUESTIONS_SYSTEM, parseQuestionsReply, questionsMessages } from "./prompts";

// "Also answers" for the current draft (see content.ts). One call over the candidate list.
export async function findAlsoAnswers(input: {
  title: string;
  content: StoryContent;
  storyType: StoryType | undefined;
  candidates: Candidate[];
}): Promise<StoryAlsoAnswers> {
  const draft = input.content.draft;
  if (!draft) throw new Error("Write the story first.");
  const story = draftText(draft.parts, input.storyType);
  if (!story.trim()) throw new Error("Write the story first.");
  const base = { draftWrittenAt: draft.writtenAt, checkedAt: new Date().toISOString() };
  if (input.candidates.length === 0) return { questions: [], model: "", ...base };
  const result = await generateForStep("storyQuestions", {
    system: QUESTIONS_SYSTEM,
    messages: questionsMessages({
      title: input.title,
      storyType: input.storyType?.label,
      story,
      asked: input.content.asked,
      candidates: input.candidates,
    }),
  });
  if (result.stopReason === "refusal") throw new Error("The model declined to check this story.");
  return {
    questions: parseQuestionsReply(result.text, input.candidates),
    model: result.model,
    ...base,
  };
}

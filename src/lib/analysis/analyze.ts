import "server-only";
import { generateForStep } from "@/lib/ai";
import type { StoryContent } from "@/lib/stories/content";
import type { StoryType } from "@/lib/stories/story-types";
import { type BuilderTargets, hasTargets, targetsTranscript } from "@/lib/stories/targets";
import { writtenParts, type StoryAnalysis } from "./content";
import { ANALYZE_SYSTEM, analyzeMessages, parseAnalyzeReply } from "./prompts";

// "Why it works" for the current draft (see content.ts). One call; quotes that aren't in their
// paragraph are dropped in code, and a paragraph the model skipped simply has no note.
export async function analyzeStory(input: {
  title: string;
  content: StoryContent;
  storyType: StoryType | undefined;
  targets: BuilderTargets | undefined;
}): Promise<StoryAnalysis> {
  const draft = input.content.draft;
  if (!draft) throw new Error("Write the story first.");
  const paragraphs = writtenParts(draft.parts, input.storyType);
  if (paragraphs.length === 0) throw new Error("Write the story first.");
  const result = await generateForStep("storyAnalyze", {
    system: ANALYZE_SYSTEM,
    messages: analyzeMessages({
      title: input.title,
      storyType: input.storyType?.label,
      paragraphs,
      asked: input.content.asked,
      targets: hasTargets(input.targets) ? targetsTranscript(input.targets) : "",
    }),
  });
  if (result.stopReason === "refusal") throw new Error("The model declined to analyze this story.");
  const reply = parseAnalyzeReply(result.text, paragraphs);
  return {
    summary: reply.summary,
    parts: reply.parts,
    model: result.model,
    draftWrittenAt: draft.writtenAt,
    analyzedAt: new Date().toISOString(),
  };
}

// Help that fades (Craig, 2026-11-12, from the competitor and learning-methods review). Help that a
// beginner needs slows down someone who already knows how (the "expertise reversal" effect), so the
// builder's opening screen gives less help the more behavioral stories the user has written:
//   full:  their first story. The example story is open, and the memory joggers and Quick start
//          taps show under the opening question.
//   some:  their second. The example folds to a link; joggers show, Quick start folds.
//   light: their third and later. Just the question and its hint; one "Need a nudge?" tap opens
//          the joggers and Quick start.
// "Show me a good answer" stays one tap away on every question at every amount.
//
// Plain logic, safe to import in client components.

import { hasDraft, type StoryContent } from "./content";
import { getStoryType } from "./story-types";
import { isToughType } from "@/lib/tough/questions";

export type HelpAmount = "full" | "some" | "light";

type StoryLike = { id: string; storyType: string | null; content: StoryContent };

// A behavioral (STAR) story with a written draft: About me and tough questions don't count.
export function isWrittenBehavioral(story: Omit<StoryLike, "id">): boolean {
  if (isToughType(story.storyType) || story.content.tough) return false;
  return getStoryType(story.storyType)?.format === "star" && hasDraft(story.content);
}

// How many behavioral stories the user has written, the open one left out.
export function writtenBefore(stories: StoryLike[], currentId: string | null): number {
  return stories.filter((s) => s.id !== currentId && isWrittenBehavioral(s)).length;
}

export function helpAmount(written: number): HelpAmount {
  if (written <= 0) return "full";
  if (written === 1) return "some";
  return "light";
}

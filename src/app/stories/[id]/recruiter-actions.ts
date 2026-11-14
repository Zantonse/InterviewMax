"use server";

import { unstable_rethrow } from "next/navigation";
import { ModelError } from "@/lib/ai";
import { numbersForStory } from "@/lib/numbers/checklist";
import { getNumbersChecklistSafely } from "@/lib/numbers/data";
import { canRecruiter } from "@/lib/recruiter/content";
import { makeRecruiterVersion } from "@/lib/recruiter/make";
import { getStory, updateStory } from "@/lib/stories/data";
import { getStoryType } from "@/lib/stories/story-types";
import type { BuilderResult } from "./actions";

// "Recruiter version": the written story cut to under a minute, in plain words, for a recruiter
// screen. Never touches the draft or its grade.
export async function makeRecruiter(storyId: string): Promise<BuilderResult> {
  try {
    const story = await getStory(String(storyId));
    if (!story) return { ok: false, error: "We couldn't find that story." };
    const storyType = getStoryType(story.storyType);
    if (!story.content.draft) {
      return { ok: false, error: "Write the story first, then I'll make the recruiter version." };
    }
    if (!canRecruiter(storyType)) {
      return { ok: false, error: "Tell me about yourself is shaped per job on each job page." };
    }
    const numbers = numbersForStory(await getNumbersChecklistSafely(), story.storyType);
    const recruiter = await makeRecruiterVersion({
      title: story.title,
      content: story.content,
      storyType,
      extraAnswers: numbers.flatMap((n) => (n.value ? [n.value] : [])).join("\n"),
    });
    const content = { ...story.content, recruiter };
    await updateStory(story.id, { content });
    return { ok: true, content, title: story.title };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Recruiter version failed", err);
    if (err instanceof ModelError) {
      return { ok: false, error: "The writing assistant didn't respond. Try again in a moment." };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong. Try again." };
  }
}

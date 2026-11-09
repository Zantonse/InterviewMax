"use server";

import { unstable_rethrow } from "next/navigation";
import { ModelError } from "@/lib/ai";
import { canExec } from "@/lib/exec/content";
import { makeExecVersion } from "@/lib/exec/make";
import { getExecModeSafely } from "@/lib/exec/settings";
import { numbersForStory } from "@/lib/numbers/checklist";
import { getNumbersChecklistSafely } from "@/lib/numbers/data";
import { getStory, updateStory } from "@/lib/stories/data";
import { getStoryType } from "@/lib/stories/story-types";
import type { BuilderResult } from "./actions";

// "Exec version": the written story cut to 30 seconds, answer first. Never touches the draft or
// its grade.
export async function makeExec(storyId: string): Promise<BuilderResult> {
  try {
    if (!(await getExecModeSafely())) {
      return { ok: false, error: "Turn on Exec mode in Settings first." };
    }
    const story = await getStory(String(storyId));
    if (!story) return { ok: false, error: "We couldn't find that story." };
    const storyType = getStoryType(story.storyType);
    if (!story.content.draft) {
      return { ok: false, error: "Write the story first, then I'll make the exec version." };
    }
    if (!canExec(storyType)) {
      return { ok: false, error: "Tell me about yourself is shaped per job on each job page." };
    }
    const numbers = numbersForStory(await getNumbersChecklistSafely(), story.storyType);
    const exec = await makeExecVersion({
      title: story.title,
      content: story.content,
      storyType,
      extraAnswers: numbers.flatMap((n) => (n.value ? [n.value] : [])).join("\n"),
    });
    const content = { ...story.content, exec };
    await updateStory(story.id, { content });
    return { ok: true, content, title: story.title };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Exec version failed", err);
    if (err instanceof ModelError) {
      return { ok: false, error: "The writing assistant didn't respond. Try again in a moment." };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong. Try again." };
  }
}

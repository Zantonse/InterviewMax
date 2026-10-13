"use server";

import { redirect } from "next/navigation";
import { emptyContent } from "@/lib/stories/content";
import { insertStory } from "@/lib/stories/data";
import { requiredStoryStatus } from "@/lib/stories/required";
import { REQUIRED_STORY_TYPE_ID, getStoryType } from "@/lib/stories/story-types";

export async function startStory(formData: FormData) {
  const storyType = getStoryType(String(formData.get("storyType") ?? ""));
  if (!storyType) redirect("/stories/new");

  // There's one "Tell me about yourself"; the other stories can be started in any order.
  if (storyType.id === REQUIRED_STORY_TYPE_ID) {
    const aboutMe = await requiredStoryStatus();
    if (aboutMe.storyId) redirect(`/stories/${aboutMe.storyId}`);
  }

  const id = await insertStory({
    title: storyType.label,
    storyType: storyType.id,
    themes: storyType.themes,
    content: emptyContent(),
  });
  redirect(`/stories/${id}`);
}

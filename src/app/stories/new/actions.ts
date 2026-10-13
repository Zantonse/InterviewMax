"use server";

import { redirect } from "next/navigation";
import { emptyContent } from "@/lib/stories/content";
import { insertStory } from "@/lib/stories/data";
import { requiredStoryStatus } from "@/lib/stories/required";
import { REQUIRED_STORY_TYPE_ID, getStoryType } from "@/lib/stories/story-types";

export async function startStory(formData: FormData) {
  const storyType = getStoryType(String(formData.get("storyType") ?? ""));
  if (!storyType) redirect("/stories/new");

  // "Tell me about yourself" comes first, and there's one of it.
  const required = await requiredStoryStatus();
  if (storyType.id === REQUIRED_STORY_TYPE_ID) {
    if (required.storyId) redirect(`/stories/${required.storyId}`);
  } else if (!required.drafted) {
    redirect(required.storyId ? `/stories/${required.storyId}` : "/stories/new");
  }

  const id = await insertStory({
    title: storyType.label,
    storyType: storyType.id,
    themes: storyType.themes,
    content: emptyContent(),
  });
  redirect(`/stories/${id}`);
}

"use server";

import { redirect } from "next/navigation";
import { emptyContent, type StoryContent } from "@/lib/stories/content";
import { insertStory } from "@/lib/stories/data";
import { requiredStoryStatus } from "@/lib/stories/required";
import { REQUIRED_STORY_TYPE_ID, cleanAsked, getStoryType } from "@/lib/stories/story-types";
import { trackEvent } from "@/lib/usage/track";

// Opens the builder for a behavioral story, optionally answering one interview question ("asked").
// Nothing is saved yet: the story is created with the user's first answer (createStory), so
// tapping a story and leaving doesn't leave an empty one behind.
export async function startStory(formData: FormData) {
  const storyType = getStoryType(String(formData.get("storyType") ?? ""));
  if (!storyType) redirect("/stories/new");

  // There's one "Tell me about yourself", saved straight away so Map my role (which needs a saved
  // story) can come first. The other stories can be started in any order.
  if (storyType.id === REQUIRED_STORY_TYPE_ID) {
    const aboutMe = await requiredStoryStatus();
    if (aboutMe.storyId) redirect(`/stories/${aboutMe.storyId}`);
    const id = await insertStory({
      title: storyType.label,
      storyType: storyType.id,
      themes: storyType.themes,
      content: emptyContent(),
    });
    await trackEvent("story_started");
    redirect(`/stories/${id}`);
  }

  const asked = cleanAsked(formData.get("asked"));
  redirect(`/stories/new/${storyType.id}${asked ? `?q=${encodeURIComponent(asked)}` : ""}`);
}

export async function createStory(
  storyTypeId: string,
  asked?: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const storyType = getStoryType(storyTypeId);
  // "Tell me about yourself" is saved when it's started (see startStory).
  if (!storyType || storyType.format === "intro") return { ok: false, error: "Unknown story type." };
  const question = cleanAsked(asked);
  const content: StoryContent = { ...emptyContent(), ...(question ? { asked: question } : {}) };
  try {
    const id = await insertStory({
      title: storyType.label,
      storyType: storyType.id,
      themes: storyType.themes,
      content,
    });
    await trackEvent("story_started");
    return { ok: true, id };
  } catch (error) {
    console.error("Starting a story failed", error);
    return { ok: false, error: "Your story couldn't be saved. Try again in a minute." };
  }
}

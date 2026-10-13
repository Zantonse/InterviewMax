"use server";

import { redirect } from "next/navigation";
import { emptyContent } from "@/lib/stories/content";
import { insertStory } from "@/lib/stories/data";
import { getStoryType } from "@/lib/stories/story-types";

export async function startStory(formData: FormData) {
  const storyType = getStoryType(String(formData.get("storyType") ?? ""));
  if (!storyType) redirect("/stories/new");

  const id = await insertStory({
    title: storyType.label,
    storyType: storyType.id,
    themes: storyType.themes,
    content: emptyContent(),
  });
  redirect(`/stories/${id}`);
}

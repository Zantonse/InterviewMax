"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { deleteStory } from "@/lib/stories/data";

// Deletes one of the signed-in user's stories for good, then goes back home. Row-level security
// only lets the owner delete. Deleting "Tell me about yourself" is allowed: the other stories stay,
// and new ones lock again until a new one has a draft.
export async function removeStory(storyId: string): Promise<{ error: string }> {
  try {
    await deleteStory(String(storyId));
  } catch (err) {
    unstable_rethrow(err);
    console.error("Deleting a story failed", err);
    return { error: err instanceof Error ? err.message : "Couldn't delete the story. Try again." };
  }
  redirect("/");
}

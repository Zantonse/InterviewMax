"use server";

import { redirect } from "next/navigation";
import { emptyContent } from "@/lib/stories/content";
import { insertStory, listStories } from "@/lib/stories/data";
import { getToughQuestion, toughStoryType } from "@/lib/tough/questions";

// Starts the coach for one tough question, or opens the answer already started for it: each
// question has one answer in the bank.
export async function startTough(formData: FormData) {
  const question = getToughQuestion(String(formData.get("question") ?? ""));
  if (!question) redirect("/tough-questions");
  const storyType = toughStoryType(question.id);

  const existing = (await listStories()).find((s) => s.storyType === storyType);
  if (existing) redirect(`/tough-questions/${existing.id}`);

  const id = await insertStory({
    title: question.label,
    storyType,
    themes: ["tough question"],
    content: emptyContent(),
  });
  redirect(`/tough-questions/${id}`);
}

"use server";

import { refresh } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { ModelError } from "@/lib/ai";
import { MAX_QUICK_ANSWER_LENGTH, QUICK_QUESTIONS, SOURCE_LABELS } from "@/lib/finder/content";
import { getStoryFinder, saveStoryFinder } from "@/lib/finder/data";
import { findMoments, finderSources } from "@/lib/finder/find";
import { emptyContent } from "@/lib/stories/content";
import { insertStory, listStories } from "@/lib/stories/data";
import { getStoryType } from "@/lib/stories/story-types";

export type FindResult = { ok: true } | { ok: false; error: string };

// Reads the user's resume, LinkedIn profile and role map for story moments, and saves them.
export async function findStoryMoments(): Promise<FindResult> {
  try {
    const [stories, finder] = await Promise.all([listStories(), getStoryFinder()]);
    const sources = await finderSources(stories, finder);
    if (sources.length === 0) {
      return { ok: false, error: "Add your resume, or answer the three questions, first." };
    }
    await findMoments(stories, finder, sources);
  } catch (err) {
    return failure(err);
  }
  refresh();
  return { ok: true };
}

// No resume: three quick answers about recent work stand in for one.
export async function saveQuickAnswers(_prev: FindResult | null, formData: FormData) {
  const answers: Record<string, string> = {};
  for (const q of QUICK_QUESTIONS) {
    const text = String(formData.get(q.id) ?? "").trim();
    if (text.length > MAX_QUICK_ANSWER_LENGTH) {
      return { ok: false as const, error: "Keep each answer to a short paragraph." };
    }
    if (text) answers[q.id] = text;
  }
  if (Object.keys(answers).length < 2) {
    return { ok: false as const, error: "Answer at least two of the three, in a sentence or two." };
  }
  try {
    const [stories, finder] = await Promise.all([listStories(), getStoryFinder()]);
    const withAnswers = { ...(finder ?? {}), answers };
    await saveStoryFinder(withAnswers);
    await findMoments(stories, withAnswers, await finderSources(stories, withAnswers));
  } catch (err) {
    return failure(err);
  }
  refresh();
  return { ok: true as const };
}

// One tap: start the builder for a suggested moment, with the moment filled in as the first answer
// for the user to confirm.
export async function startFromMoment(formData: FormData) {
  const id = String(formData.get("moment") ?? "");
  const finder = await getStoryFinder();
  const moment = finder?.moments?.find((m) => m.id === id);
  const storyType = getStoryType(moment?.storyType);
  if (!moment || !storyType) redirect("/stories/find");

  const storyId = await insertStory({
    title: moment.moment.slice(0, 80),
    storyType: storyType.id,
    themes: storyType.themes,
    content: {
      ...emptyContent(),
      seed: {
        moment: moment.moment,
        question: moment.question,
        quote: moment.quote,
        sourceLabel: SOURCE_LABELS[moment.source],
      },
    },
  });
  redirect(`/stories/${storyId}`);
}

function failure(err: unknown): FindResult {
  unstable_rethrow(err);
  console.error("Story finder failed", err);
  if (err instanceof ModelError) {
    return { ok: false, error: "The model couldn't be reached. Try again in a minute." };
  }
  return {
    ok: false,
    error: err instanceof Error ? err.message : "Something went wrong. Try again.",
  };
}

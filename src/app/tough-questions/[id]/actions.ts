"use server";

import { unstable_rethrow } from "next/navigation";
import { ModelError } from "@/lib/ai";
import { getJob } from "@/lib/jobs/data";
import type { StoryContent } from "@/lib/stories/content";
import { getStory, updateStory, type StoryRecord } from "@/lib/stories/data";
import { writeToughAnswer } from "@/lib/tough/coach";
import {
  MAX_EDITED_ANSWER_LENGTH,
  MAX_TOUGH_ANSWER_LENGTH,
  getToughQuestion,
  missingPrompts,
} from "@/lib/tough/questions";

export type ToughResult = { ok: true; content: StoryContent } | { ok: false; error: string };

// Saves the answers about the user's situation without writing anything.
export async function saveToughAnswers(
  storyId: string,
  answers: Record<string, string>,
  jobId: string | null,
): Promise<ToughResult> {
  return withToughStory(storyId, async (story, question) => {
    const content = withAnswers(story.content, question.prompts, answers, jobId);
    await updateStory(storyId, { content });
    return { ok: true, content };
  });
}

// Saves the answers, then writes the short spoken answer from them (one model call, checked in
// code). Writing again replaces any edits the user made to the last one.
export async function writeTough(
  storyId: string,
  answers: Record<string, string>,
  jobId: string | null,
): Promise<ToughResult> {
  return withToughStory(storyId, async (story, question) => {
    const content = withAnswers(story.content, question.prompts, answers, jobId);
    if (missingPrompts(question, content.answers).length > 0) {
      return fail("Answer each question that isn't marked optional first.");
    }
    const job = content.tough?.jobId ? await getJob(content.tough.jobId).catch(() => null) : null;
    // Saved first, so the answers survive a failed write.
    await updateStory(storyId, { content });
    const written = await writeToughAnswer(
      question,
      content.answers,
      job && { title: job.title, company: job.company, description: job.description },
    );
    const next: StoryContent = {
      ...content,
      tough: { ...(job ? { jobId: job.id } : {}), note: written.note },
      draft: {
        parts: { answer: written.answer },
        untracedNumbers: written.untracedNumbers,
        model: written.model,
        writtenAt: new Date().toISOString(),
      },
    };
    await updateStory(storyId, { content: next });
    return { ok: true, content: next };
  });
}

// Keeps the user's own edit of the written answer. Their words, so its numbers count as theirs.
export async function saveToughEdit(storyId: string, text: string): Promise<ToughResult> {
  const answer = typeof text === "string" ? text.trim() : "";
  if (!answer) return fail("The answer can't be empty.");
  if (answer.length > MAX_EDITED_ANSWER_LENGTH) return fail("That answer is too long to save.");
  return withToughStory(storyId, async (story) => {
    const draft = story.content.draft;
    if (!draft) return fail("Write the answer first.");
    const content: StoryContent = {
      ...story.content,
      tough: { ...story.content.tough, edited: true },
      draft: { ...draft, parts: { answer }, untracedNumbers: [] },
    };
    await updateStory(storyId, { content });
    return { ok: true, content };
  });
}

function withAnswers(
  content: StoryContent,
  prompts: readonly { id: string }[],
  answers: Record<string, string>,
  jobId: string | null,
): StoryContent {
  const cleaned: Record<string, string> = {};
  for (const p of prompts) {
    const value = answers?.[p.id];
    if (typeof value === "string" && value.trim()) {
      cleaned[p.id] = value.trim().slice(0, MAX_TOUGH_ANSWER_LENGTH);
    }
  }
  const tough = { ...content.tough };
  if (typeof jobId === "string" && jobId) tough.jobId = jobId;
  else delete tough.jobId;
  return { ...content, answers: cleaned, tough };
}

async function withToughStory(
  storyId: string,
  run: (
    story: StoryRecord,
    question: NonNullable<ReturnType<typeof getToughQuestion>>,
  ) => Promise<ToughResult>,
): Promise<ToughResult> {
  try {
    const story = await getStory(String(storyId));
    const question = getToughQuestion(story?.storyType);
    if (!story || !question) return fail("That answer wasn't found.");
    return await run(story, question);
  } catch (err) {
    unstable_rethrow(err);
    console.error("Tough-questions coach failed", err);
    if (err instanceof ModelError) return fail("The coach couldn't be reached. Try again in a minute.");
    return fail(err instanceof Error ? err.message : "Something went wrong. Try again.");
  }
}

function fail(error: string): ToughResult {
  return { ok: false, error };
}

"use server";

import { unstable_rethrow } from "next/navigation";
import { ModelError } from "@/lib/ai";
import { probeStory, writeStory } from "@/lib/stories/builder";
import { builderStage, type StoryContent } from "@/lib/stories/content";
import { getStory, updateStory } from "@/lib/stories/data";
import { readUploadedAnswer } from "@/lib/stories/upload";
import { MAX_ANSWER_LENGTH, coreQuestions, getStoryType } from "@/lib/stories/story-types";

export type BuilderResult =
  | { ok: true; content: StoryContent; title: string }
  | { ok: false; error: string };

export async function saveAnswer(
  storyId: string,
  questionId: string,
  answer: string,
): Promise<BuilderResult> {
  const text = cleanAnswer(answer);
  if (typeof text !== "string") return text;

  return withStory(storyId, async (story) => {
    const questions = coreQuestions(getStoryType(story.storyType));
    if (!questions.some((q) => q.id === questionId)) return fail("Unknown question.");
    const content = {
      ...story.content,
      answers: { ...story.content.answers, [questionId]: text },
    };
    await updateStory(storyId, { content });
    return { ok: true, content, title: story.title };
  });
}

export async function saveFollowUpAnswer(
  storyId: string,
  index: number,
  answer: string,
): Promise<BuilderResult> {
  const text = cleanAnswer(answer);
  if (typeof text !== "string") return text;

  return withStory(storyId, async (story) => {
    const followUps = story.content.followUps ?? [];
    if (!Number.isInteger(index) || index < 0 || index >= followUps.length) {
      return fail("Unknown follow-up question.");
    }
    const content = {
      ...story.content,
      followUps: followUps.map((f, i) => (i === index ? { ...f, answer: text } : f)),
    };
    await updateStory(storyId, { content });
    return { ok: true, content, title: story.title };
  });
}

// "Tell me about yourself" only: use an answer the user prepared earlier instead of the
// scripted questions. The client then runs call one on it, as after the last scripted answer.
export async function importPreparedAnswer(
  storyId: string,
  formData: FormData,
): Promise<BuilderResult> {
  return withStory(storyId, async (story) => {
    const storyType = getStoryType(story.storyType);
    if (storyType?.format !== "intro") return fail("Uploads are for Tell me about yourself.");
    if (builderStage(story.content, storyType) !== "core") {
      return fail("This story is already past the questions.");
    }
    const file = formData.get("file");
    if (!(file instanceof File)) return fail("Choose a file first.");

    let text: string;
    try {
      text = await readUploadedAnswer(file);
    } catch (err) {
      return fail(err instanceof Error ? err.message : "That file couldn't be read.");
    }
    const content = {
      ...story.content,
      imported: { fileName: file.name.slice(0, 200), text },
    };
    await updateStory(storyId, { content });
    return { ok: true, content, title: story.title };
  });
}

// Call one. Runs once, after the last scripted answer.
export async function askFollowUps(storyId: string): Promise<BuilderResult> {
  return withStory(storyId, async (story) => {
    const stage = builderStage(story.content, getStoryType(story.storyType));
    if (stage === "core") return fail("Answer the remaining questions first.");
    if (stage !== "probe") return { ok: true, content: story.content, title: story.title };

    const followUps = await probeStory(story.content, getStoryType(story.storyType));
    const content = { ...story.content, followUps };
    await updateStory(storyId, { content });
    return { ok: true, content, title: story.title };
  });
}

// Call two. Writes the story, or rewrites it if a draft already exists.
export async function writeDraft(storyId: string): Promise<BuilderResult> {
  return withStory(storyId, async (story) => {
    const stage = builderStage(story.content, getStoryType(story.storyType));
    if (stage !== "write" && stage !== "drafted")
      return fail("Answer the remaining questions first.");

    const { title, draft } = await writeStory(story.content, getStoryType(story.storyType));
    const content = { ...story.content, draft };
    const newTitle = title || story.title;
    await updateStory(storyId, { content, title: newTitle });
    return { ok: true, content, title: newTitle };
  });
}

async function withStory(
  storyId: string,
  run: (story: NonNullable<Awaited<ReturnType<typeof getStory>>>) => Promise<BuilderResult>,
): Promise<BuilderResult> {
  try {
    const story = await getStory(String(storyId));
    if (!story) return fail("We couldn't find that story.");
    return await run(story);
  } catch (err) {
    // redirect() (signed out) throws a control-flow error that must propagate.
    unstable_rethrow(err);
    console.error("Story builder action failed", err);
    if (err instanceof ModelError) {
      return fail("The writing assistant didn't respond. Try again in a moment.");
    }
    return fail(err instanceof Error ? err.message : "Something went wrong. Try again.");
  }
}

function cleanAnswer(answer: unknown): string | BuilderResult {
  const text = typeof answer === "string" ? answer.trim() : "";
  if (!text) return fail("Type an answer first.");
  if (text.length > MAX_ANSWER_LENGTH) {
    return fail(`Keep it under ${MAX_ANSWER_LENGTH.toLocaleString("en-US")} characters.`);
  }
  return text;
}

function fail(error: string): BuilderResult {
  return { ok: false, error };
}

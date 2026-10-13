"use server";

import { unstable_rethrow } from "next/navigation";
import { ModelError } from "@/lib/ai";
import { gradeStory, prefillFromProfile, probeStory, writeStory } from "@/lib/stories/builder";
import {
  MAX_PROBE_ROUNDS,
  builderStage,
  canStrengthen,
  probeRounds,
  type StoryContent,
} from "@/lib/stories/content";
import { getStory, updateStory } from "@/lib/stories/data";
import { readLinkedInPdf, readUploadedAnswer } from "@/lib/stories/upload";
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
      nothingMoreToAsk: false,
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
      nothingMoreToAsk: false,
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

// "Tell me about yourself" only: read a LinkedIn profile PDF and fill in the scripted questions it
// answers. Answers the user already gave are kept; the rest are asked as usual.
export async function importLinkedIn(storyId: string, formData: FormData): Promise<BuilderResult> {
  return withStory(storyId, async (story) => {
    const storyType = getStoryType(story.storyType);
    if (storyType?.format !== "intro")
      return fail("LinkedIn uploads are for Tell me about yourself.");
    if (builderStage(story.content, storyType) !== "core") {
      return fail("This story is already past the questions.");
    }
    const file = formData.get("file");
    if (!(file instanceof File)) return fail("Choose a file first.");

    let text: string;
    try {
      text = await readLinkedInPdf(file);
    } catch (err) {
      return fail(err instanceof Error ? err.message : "That PDF couldn't be read.");
    }

    const prefill = await prefillFromProfile(text);
    const answers = { ...story.content.answers };
    const prefilled: string[] = [];
    for (const q of coreQuestions(storyType)) {
      if (answers[q.id]?.trim() || !prefill[q.id]) continue;
      answers[q.id] = prefill[q.id];
      prefilled.push(q.id);
    }
    const content = {
      ...story.content,
      answers,
      linkedin: { fileName: file.name.slice(0, 200), text, prefilled },
    };
    await updateStory(storyId, { content });
    return { ok: true, content, title: story.title };
  });
}

// Call one. Runs after the last scripted answer, once more after the first follow-ups, and again
// whenever the user asks to make a drafted story stronger.
export async function askFollowUps(storyId: string): Promise<BuilderResult> {
  return withStory(storyId, async (story) => {
    const stage = builderStage(story.content, getStoryType(story.storyType));
    if (stage === "core") return fail("Answer the remaining questions first.");
    const again = stage === "drafted" && canStrengthen(story.content);
    if (stage !== "probe" && !again)
      return { ok: true, content: story.content, title: story.title };

    const round = probeRounds(story.content) + 1;
    const asked = await probeStory(story.content, getStoryType(story.storyType), round);
    const content = {
      ...story.content,
      followUps: [...(story.content.followUps ?? []), ...asked],
      probeDone: asked.length === 0 || round >= MAX_PROBE_ROUNDS,
      nothingMoreToAsk: asked.length === 0,
    };
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

// Grades the current draft. Runs right after each write, and again on request.
export async function gradeDraft(storyId: string): Promise<BuilderResult> {
  return withStory(storyId, async (story) => {
    const draft = story.content.draft;
    if (!draft) return fail("Write the story first, then I'll grade it.");
    const grade = await gradeStory(story.title, draft, getStoryType(story.storyType));
    const content = { ...story.content, grade };
    await updateStory(storyId, { content });
    return { ok: true, content, title: story.title };
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

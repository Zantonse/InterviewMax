"use server";

import { unstable_rethrow } from "next/navigation";
import { ModelError } from "@/lib/ai";
import { getJob } from "@/lib/jobs/data";
import type { StoryContent } from "@/lib/stories/content";
import { getStory, updateStory, type StoryRecord } from "@/lib/stories/data";
import { askFollowUp, giveFeedback } from "@/lib/practice/coach";
import {
  MAX_PRACTICE_ANSWER_LENGTH,
  type PracticeItem,
  itemStep,
  withAnswer,
} from "@/lib/practice/content";
import type { VoiceStats } from "@/lib/practice/delivery";
import { trackEvent } from "@/lib/usage/track";
import { writeToughAnswer } from "@/lib/tough/coach";
import { drillReference, newToughDrill, toughDrill } from "@/lib/tough/drill";
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

// Starts a follow-up drill on the written answer, replacing the last one.
export async function startToughDrill(storyId: string): Promise<ToughResult> {
  return withToughStory(storyId, async (story, question) => {
    if (!story.content.draft?.parts.answer?.trim()) return fail("Write the answer first.");
    const content = withDrill(story.content, newToughDrill(question));
    await updateStory(storyId, { content });
    await trackEvent("tough_drill_started");
    return { ok: true, content };
  });
}

// Saves the user's spoken answer in the drill, then the interviewer pushes back, or gives the
// feedback once it has no more. The answer is saved before the model call, so a failure loses
// nothing: continueToughDrill runs it again.
export async function answerToughDrill(
  storyId: string,
  answer: string,
  seconds: number | null,
  voice: VoiceStats | null = null,
): Promise<ToughResult> {
  const text = typeof answer === "string" ? answer.trim() : "";
  if (!text) return fail("Say or type an answer first.");
  if (text.length > MAX_PRACTICE_ANSWER_LENGTH) return fail("That answer is too long.");
  return withToughStory(storyId, async (story, question) => {
    const drill = toughDrill(story.content);
    if (!drill || itemStep(drill) !== "answer") return fail("Start the drill again.");
    const content = withDrill(story.content, withAnswer(drill, text, seconds, voice));
    await updateStory(storyId, { content });
    return advanceDrill(storyId, content, question);
  });
}

export async function continueToughDrill(storyId: string): Promise<ToughResult> {
  return withToughStory(storyId, async (story, question) =>
    advanceDrill(storyId, story.content, question),
  );
}

async function advanceDrill(
  storyId: string,
  content: StoryContent,
  question: NonNullable<ReturnType<typeof getToughQuestion>>,
): Promise<ToughResult> {
  const drill = toughDrill(content);
  if (!drill) return fail("Start the drill again.");
  const step = itemStep(drill);
  if (step === "answer" || step === "done") return { ok: true, content };
  const job = content.tough?.jobId ? await getJob(content.tough.jobId).catch(() => null) : null;
  const role = job ? { title: job.title, company: job.company, level: job.level } : undefined;
  let next: PracticeItem = drill;
  if (step === "probe") {
    const followUp = await askFollowUp({
      question: drill.question,
      role,
      turns: drill.turns,
      kind: "tough",
    });
    next = followUp
      ? { ...drill, turns: [...drill.turns, { question: followUp.question, gap: followUp.gap }] }
      : { ...drill, probeDone: true };
  }
  if (itemStep(next) === "feedback") {
    const feedback = await giveFeedback(
      {
        question: drill.question,
        role,
        reference: drillReference(question, content),
        turns: next.turns,
        kind: "tough",
      },
      "tough",
    );
    // New details belong in the situation answers, which the user edits on this page.
    next = { ...next, feedback: { ...feedback, newFacts: [] } };
  }
  const saved = withDrill(content, next);
  await updateStory(storyId, { content: saved });
  return { ok: true, content: saved };
}

function withDrill(content: StoryContent, drill: PracticeItem): StoryContent {
  return { ...content, tough: { ...content.tough, drill } };
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

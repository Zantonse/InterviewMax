"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { ModelError } from "@/lib/ai";
import { getJob } from "@/lib/jobs/data";
import { askFollowUp, giveFeedback } from "@/lib/practice/coach";
import {
  MAX_PRACTICE_ANSWER_LENGTH,
  type PracticeItem,
  currentItemIndex,
  itemStep,
  pickQuestions,
  withAnswer,
} from "@/lib/practice/content";
import {
  type PracticeSession,
  deletePracticeSession,
  getPracticeSession,
  insertPracticeSession,
  savePracticeItems,
} from "@/lib/practice/data";
import type { VoiceStats } from "@/lib/practice/delivery";
import type { PracticeContext } from "@/lib/practice/prompts";
import { hasDraft, probeRounds } from "@/lib/stories/content";
import { getStory, listStories, updateStory } from "@/lib/stories/data";
import { draftText } from "@/lib/stories/grading";
import { answersTranscript } from "@/lib/stories/prompts";
import { REQUIRED_STORY_TYPE_ID, getStoryType } from "@/lib/stories/story-types";
import { tailoredText } from "@/lib/stories/tailored";
import { trackEvent } from "@/lib/usage/track";

export type PracticeResult =
  | { ok: true; items: PracticeItem[]; finishedAt: string | null }
  | { ok: false; error: string; items?: PracticeItem[]; finishedAt?: string | null };

export type StartState = { error?: string } | null;

// Starts a five-question round for a job: gaps and weaker stories first. With mode "screen", an AI
// screen round: the same questions, timed, with no follow-ups.
export async function startPractice(_prev: StartState, formData: FormData): Promise<StartState> {
  let id: string;
  const screen = formData.get("mode") === "screen";
  try {
    const job = await getJob(String(formData.get("jobId") ?? ""));
    if (!job) return { error: "That target job wasn't found." };
    if (!job.likelyQuestions) {
      return { error: "Predict this job's likely questions first, then practice them." };
    }
    const picked = pickQuestions(job.likelyQuestions.questions, await listStories());
    if (picked.length === 0) return { error: "This job has no likely questions to practice yet." };
    const items = screen ? picked.map((i) => ({ ...i, screen: true })) : picked;
    id = await insertPracticeSession({ targetJobId: job.id, items });
    await trackEvent(screen ? "screen_practice_started" : "practice_started");
  } catch (err) {
    unstable_rethrow(err);
    console.error("Practice: starting a round failed", err);
    return { error: err instanceof Error ? err.message : "The practice round couldn't start." };
  }
  redirect(`/practice/${id}`);
}

// Saves the user's answer to the turn waiting for one, then lets the interviewer decide on a
// follow-up, or gives feedback once there are no more. The answer is saved before any model call,
// so a failed call loses nothing: "Try again" runs it again (continuePractice). In an AI screen
// round nothing follows the answer: feedback comes once every question is answered.
export async function answerPractice(
  sessionId: string,
  index: number,
  answer: string,
  seconds: number | null,
  voice: VoiceStats | null = null,
): Promise<PracticeResult> {
  const text = typeof answer === "string" ? answer.trim() : "";
  if (!text) return fail("Say or type an answer first.");
  if (text.length > MAX_PRACTICE_ANSWER_LENGTH) {
    return fail(
      `Keep it under ${MAX_PRACTICE_ANSWER_LENGTH.toLocaleString("en-US")} characters.`,
    );
  }
  return withSession(sessionId, index, async (session, item) => {
    if (itemStep(item) !== "answer") return fail("That question has already been answered.");
    const answered = withAnswer(item, text, seconds, voice);
    const items = replace(session.items, index, answered);
    await savePracticeItems(session.id, items, session.finishedAt);
    await trackEvent("practice_answered");
    if (item.screen) return ok({ ...session, items });
    return advance({ ...session, items }, index);
  });
}

// Runs the follow-up or feedback a question is waiting on, e.g. after a model call failed.
export async function continuePractice(sessionId: string, index: number): Promise<PracticeResult> {
  return withSession(sessionId, index, async (session) => advance(session, index));
}

export async function skipPractice(sessionId: string, index: number): Promise<PracticeResult> {
  return withSession(sessionId, index, async (session, item) => {
    if (item.feedback) return ok(session);
    const items = replace(session.items, index, { ...item, skipped: true });
    const finishedAt = finishedAtFor(items, session.finishedAt);
    await savePracticeItems(session.id, items, finishedAt);
    return { ok: true, items, finishedAt };
  });
}

// "Keep what's new": adds one new detail the user said, after they confirmed it, to the story that
// answers the question, as an answered follow-up. The story's draft isn't touched: the user
// rewrites it from the story page when they're ready.
export async function keepPracticeFact(
  sessionId: string,
  index: number,
  factIndex: number,
): Promise<PracticeResult> {
  return withSession(sessionId, index, async (session, item) => {
    const fact = item.feedback?.newFacts[factIndex];
    if (!item.feedback || !fact) return fail("That detail wasn't found.");
    if (fact.kept) return ok(session);
    const story = item.storyId ? await getStory(item.storyId) : null;
    if (!story || !hasDraft(story.content)) {
      return fail("The story for this question isn't there anymore.");
    }
    await updateStory(story.id, {
      content: {
        ...story.content,
        followUps: [
          ...(story.content.followUps ?? []),
          {
            question: item.question,
            gap: "practice",
            answer: fact.fact,
            round: Math.max(1, probeRounds(story.content)),
            source: "practice",
          },
        ],
      },
    });
    const items = replace(session.items, index, {
      ...item,
      feedback: {
        ...item.feedback,
        newFacts: item.feedback.newFacts.map((f, i) => (i === factIndex ? { ...f, kept: true } : f)),
      },
    });
    await savePracticeItems(session.id, items, session.finishedAt);
    return { ok: true, items, finishedAt: session.finishedAt };
  });
}

export async function removePractice(formData: FormData): Promise<void> {
  const jobId = String(formData.get("jobId") ?? "");
  await deletePracticeSession(String(formData.get("sessionId") ?? ""));
  redirect(jobId ? `/jobs/${jobId}/practice` : "/jobs");
}

// Takes a question one step on: a follow-up from the interviewer, or, when it has none left, the
// feedback. Saves after the model call.
async function advance(session: PracticeSession, index: number): Promise<PracticeResult> {
  const item = session.items[index];
  const step = itemStep(item);
  if (step === "answer" || step === "done") return ok(session);

  const job = await getJob(session.targetJobId);
  const role = job ? { title: job.title, company: job.company, level: job.level } : undefined;
  let next: PracticeItem;
  if (step === "probe") {
    const followUp = await askFollowUp({ question: item.question, role, turns: item.turns });
    // A missed layer (no follow-up when one was due) just ends the drill early: the user isn't
    // left waiting on a question that won't come.
    next = followUp
      ? { ...item, turns: [...item.turns, { question: followUp.question, gap: followUp.gap }] }
      : { ...item, probeDone: true };
    // No follow-up left: straight on to the feedback, so the user waits once, not twice.
    if (!followUp) {
      next = { ...next, feedback: await feedbackFor(next, role, session.targetJobId) };
    }
  } else {
    next = { ...item, feedback: await feedbackFor(item, role, session.targetJobId) };
  }
  const items = replace(session.items, index, next);
  const finishedAt = finishedAtFor(items, session.finishedAt);
  await savePracticeItems(session.id, items, finishedAt);
  return { ok: true, items, finishedAt };
}

async function feedbackFor(
  item: PracticeItem,
  role: PracticeContext["role"],
  jobId: string,
) {
  return giveFeedback(
    {
      question: item.question,
      role,
      reference: await referenceFor(item, jobId),
      turns: item.turns,
      ...(item.screen ? { kind: "screen" as const } : {}),
    },
    item.theme,
  );
}

// The saved story to compare a practice answer with: its written script and the answers behind
// it. For "Tell me about yourself", the version shaped for this job when there is one.
async function referenceFor(item: PracticeItem, jobId: string): Promise<PracticeContext["reference"]> {
  if (!item.storyId) return undefined;
  const story = await getStory(item.storyId);
  if (!story?.content.draft) return undefined;
  const storyType = getStoryType(story.storyType);
  const tailored =
    story.storyType === REQUIRED_STORY_TYPE_ID ? story.content.tailored?.[jobId]?.draft : undefined;
  return {
    title: story.title,
    script: tailored ? tailoredText(tailored.parts) : draftText(story.content.draft.parts, storyType),
    answers: answersTranscript(story.content, storyType),
  };
}

function finishedAtFor(items: PracticeItem[], current: string | null): string | null {
  if (currentItemIndex(items) >= 0) return null;
  return current ?? new Date().toISOString();
}

function replace(items: PracticeItem[], index: number, item: PracticeItem): PracticeItem[] {
  return items.map((it, i) => (i === index ? item : it));
}

async function withSession(
  sessionId: string,
  index: number,
  run: (session: PracticeSession, item: PracticeItem) => Promise<PracticeResult>,
): Promise<PracticeResult> {
  let session: PracticeSession | null = null;
  try {
    session = await getPracticeSession(String(sessionId));
    if (!session) return fail("We couldn't find that practice round.");
    const item = Number.isInteger(index) ? session.items[index] : undefined;
    if (!item) return fail("Unknown question.");
    return await run(session, item);
  } catch (err) {
    // redirect() (signed out) throws a control-flow error that must propagate.
    unstable_rethrow(err);
    console.error("Practice action failed", err);
    // Hand back what's saved, so the page shows the answer that was kept.
    const saved = session ? await getPracticeSession(session.id).catch(() => null) : null;
    const message =
      err instanceof ModelError
        ? "The interviewer didn't respond. Try again in a moment."
        : err instanceof Error
          ? err.message
          : "Something went wrong. Try again.";
    return saved
      ? { ok: false, error: message, items: saved.items, finishedAt: saved.finishedAt }
      : fail(message);
  }
}

function ok(session: PracticeSession): PracticeResult {
  return { ok: true, items: session.items, finishedAt: session.finishedAt };
}

function fail(error: string): PracticeResult {
  return { ok: false, error };
}

"use server";

import { unstable_rethrow } from "next/navigation";
import { ModelError } from "@/lib/ai";
import { parseAskList, type QuestionsToAsk } from "@/lib/ask/content";
import { suggestQuestionsToAsk } from "@/lib/ask/suggest";
import { getJob, saveQuestionsToAsk } from "@/lib/jobs/data";

export type AskResult = { ok: true; value: QuestionsToAsk | null } | { ok: false; error: string };

// Suggests questions to ask the interviewer for one job (a model call). Saved questions stay.
export async function suggestAsk(jobId: string): Promise<AskResult> {
  try {
    return { ok: true, value: await suggestQuestionsToAsk(String(jobId)) };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Questions to ask: suggesting failed", err);
    if (err instanceof ModelError) {
      return {
        ok: false,
        error: "The assistant didn't respond. Try again in a moment.",
      };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong. Try again.",
    };
  }
}

// Saves the list as the user left it: saved or not, edited, removed, or their own added.
export async function saveAsk(jobId: string, questions: unknown): Promise<AskResult> {
  try {
    const job = await getJob(String(jobId));
    if (!job) return { ok: false, error: "We couldn't find that job." };
    const list = parseAskList(questions);
    const value: QuestionsToAsk | null = list.length
      ? {
          questions: list,
          model: job.questionsToAsk?.model ?? "",
          generatedAt: job.questionsToAsk?.generatedAt ?? "",
        }
      : null;
    await saveQuestionsToAsk(job.id, value);
    return { ok: true, value };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Questions to ask: saving failed", err);
    return { ok: false, error: "Your change couldn't be saved. Try again." };
  }
}

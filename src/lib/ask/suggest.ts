import "server-only";
import { generateForStep } from "@/lib/ai";
import { getJob, getJobsPrep, saveQuestionsToAsk } from "@/lib/jobs/data";
import { mergeSuggestions, type QuestionsToAsk } from "./content";
import { ASK_QUESTIONS_SYSTEM, askQuestionsMessages, parseAskQuestionsReply } from "./prompts";

// Suggests questions to ask at the end of interviews for one target job and saves them on the
// job. Saved questions and the user's own stay; the old unsaved suggestions are replaced.
export async function suggestQuestionsToAsk(jobId: string): Promise<QuestionsToAsk> {
  const [job, { overview }] = await Promise.all([getJob(jobId), getJobsPrep()]);
  if (!job) throw new Error("Job not found.");
  const kept = (job.questionsToAsk?.questions ?? []).filter((q) => q.saved || q.mine);

  const result = await generateForStep("askQuestions", {
    system: ASK_QUESTIONS_SYSTEM,
    messages: askQuestionsMessages({
      job,
      focus: overview?.jobs[job.id]?.focus ?? [],
      reports: job.interviewReports,
      existing: kept.map((q) => q.question),
    }),
  });
  if (result.stopReason === "refusal") throw new Error("The model declined to suggest questions.");

  const value: QuestionsToAsk = {
    questions: mergeSuggestions(kept, parseAskQuestionsReply(result.text)),
    model: result.model,
    generatedAt: new Date().toISOString(),
  };
  await saveQuestionsToAsk(job.id, value);
  return value;
}

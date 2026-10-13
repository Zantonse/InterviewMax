import "server-only";
import { generateForStep } from "@/lib/ai";
import { getJob, getJobsPrep, listJobs, saveJobQuestions } from "@/lib/jobs/data";
import { pastQuestionsFor } from "@/lib/transcripts/content";
import { listTranscriptsForPrep } from "@/lib/transcripts/data";
import type { LikelyQuestions } from "./content";
import { LIKELY_QUESTIONS_SYSTEM, likelyQuestionsMessages, parseLikelyQuestionsReply } from "./prompts";

// Predicts one target job's likely questions and saves them on the job.
export async function predictQuestions(jobId: string): Promise<LikelyQuestions> {
  const [job, jobs, { overview }, transcripts] = await Promise.all([
    getJob(jobId),
    listJobs(),
    getJobsPrep(),
    listTranscriptsForPrep(),
  ]);
  if (!job) throw new Error("Job not found.");
  const otherJobs = jobs.filter((j) => j.id !== job.id);
  const reports = job.interviewReports;
  const past = pastQuestionsFor(job, transcripts);

  const result = await generateForStep("likelyQuestions", {
    system: LIKELY_QUESTIONS_SYSTEM,
    messages: likelyQuestionsMessages({
      job,
      otherJobs,
      shared: otherJobs.length > 0 ? (overview?.shared ?? []) : [],
      reports,
      past,
    }),
  });
  if (result.stopReason === "refusal") throw new Error("The model declined to predict questions.");

  const usedTranscripts = past.transcripts;
  const likely: LikelyQuestions = {
    questions: parseLikelyQuestionsReply(result.text, {
      hasOtherJobs: otherJobs.length > 0,
      hasReports: Boolean(reports.trim()),
      hasPastForJob: past.thisJob.length > 0,
    }),
    usedReports: Boolean(reports.trim()),
    ...(usedTranscripts > 0 ? { usedTranscripts } : {}),
    model: result.model,
    generatedAt: new Date().toISOString(),
  };
  await saveJobQuestions(job.id, { likelyQuestions: likely });
  return likely;
}

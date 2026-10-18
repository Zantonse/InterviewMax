import "server-only";
import { generateForStep } from "@/lib/ai";
import { getJob, getJobsPrep, saveCurriculum } from "@/lib/jobs/data";
import { carryConfidence, type Curriculum } from "./content";
import { CURRICULUM_SYSTEM, curriculumMessages, parseCurriculumReply } from "./prompts";

// Writes the curriculum for one target job and saves it on the job. Marks the user already made
// stay on topics the new list names again.
export async function buildCurriculum(jobId: string): Promise<Curriculum> {
  const [job, { overview }] = await Promise.all([getJob(jobId), getJobsPrep()]);
  if (!job) throw new Error("Job not found.");
  if (!job.description.trim()) throw new Error("Add this job's posting first.");

  const result = await generateForStep("jobCurriculum", {
    system: CURRICULUM_SYSTEM,
    messages: curriculumMessages({
      job,
      focus: overview?.jobs[job.id]?.focus ?? [],
      reports: job.interviewReports,
    }),
  });
  if (result.stopReason === "refusal")
    throw new Error("The model declined to write the curriculum.");

  const { summary, topics } = parseCurriculumReply(result.text, job.description);
  const value: Curriculum = {
    summary,
    topics: carryConfidence(job.curriculum?.topics ?? [], topics),
    model: result.model,
    generatedAt: new Date().toISOString(),
  };
  await saveCurriculum(job.id, value);
  return value;
}

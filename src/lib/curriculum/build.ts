import "server-only";
import { generateForStep } from "@/lib/ai";
import { getUserFieldSafely } from "@/lib/field/data";
import { getJob, getJobsPrep, saveCurriculum } from "@/lib/jobs/data";
import { carryConfidence, topicKey, type Curriculum } from "./content";
import { coreTopicsFor } from "./field-core";
import { CURRICULUM_SYSTEM, curriculumMessages, parseCurriculumReply } from "./prompts";

// Writes the curriculum for one target job and saves it on the job. Marks the user already made
// stay on topics the new list names again. Users in a field with core topics (field-core.ts) get
// those first, for the job's level; the model is told not to repeat them.
export async function buildCurriculum(jobId: string): Promise<Curriculum> {
  const [job, { overview }, field] = await Promise.all([
    getJob(jobId),
    getJobsPrep(),
    getUserFieldSafely(),
  ]);
  if (!job) throw new Error("Job not found.");
  if (!job.description.trim()) throw new Error("Add this job's posting first.");
  const core = coreTopicsFor(field.id, job.level);

  const result = await generateForStep("jobCurriculum", {
    system: CURRICULUM_SYSTEM,
    messages: curriculumMessages({
      job,
      focus: overview?.jobs[job.id]?.focus ?? [],
      reports: job.interviewReports,
      core: core.map((t) => t.name),
    }),
  });
  if (result.stopReason === "refusal")
    throw new Error("The model declined to write the curriculum.");

  const { summary, topics: fromPosting } = parseCurriculumReply(result.text, job.description);
  const coreKeys = new Set(core.map((t) => topicKey(t.name)));
  const topics = [...core, ...fromPosting.filter((t) => !coreKeys.has(topicKey(t.name)))];
  const value: Curriculum = {
    summary,
    topics: carryConfidence(job.curriculum?.topics ?? [], topics),
    model: result.model,
    generatedAt: new Date().toISOString(),
  };
  await saveCurriculum(job.id, value);
  return value;
}

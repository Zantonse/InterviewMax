import "server-only";
import { generateForStep } from "@/lib/ai";
import { overviewBasis, type JobsOverview, type Resume } from "./content";
import { getJobsPrep, listJobs, saveJobsPrep } from "./data";
import { JOBS_READ_SYSTEM, jobsReadMessages, parseJobsRead, sourceText } from "./prompts";

// The one model call in target jobs: reads every target job and the resume together. Run after a
// job is added or removed and after the resume changes; the result is kept on the profile.
export async function readJobs(): Promise<JobsOverview | null> {
  const [jobs, { resume }] = await Promise.all([listJobs(), getJobsPrep()]);
  if (jobs.length === 0) {
    await saveJobsPrep({ overview: null });
    return null;
  }
  const overview = await readJobsWith(jobs, resume);
  await saveJobsPrep({ overview });
  return overview;
}

async function readJobsWith(
  jobs: Awaited<ReturnType<typeof listJobs>>,
  resume: Resume | null,
): Promise<JobsOverview> {
  const result = await generateForStep("jobsRead", {
    system: JOBS_READ_SYSTEM,
    messages: jobsReadMessages(jobs, resume),
  });
  if (result.stopReason === "refusal") throw new Error("The model declined to read these jobs.");
  const read = parseJobsRead(result.text, jobs, sourceText(jobs, resume), Boolean(resume));
  return {
    ...read,
    basis: overviewBasis(
      jobs.map((j) => j.id),
      resume,
    ),
    model: result.model,
    readAt: new Date().toISOString(),
  };
}

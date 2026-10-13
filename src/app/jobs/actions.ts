"use server";

import { refresh } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { ModelError } from "@/lib/ai";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_JOBS,
  MAX_RESUME_LENGTH,
  MAX_TITLE_LENGTH,
  MIN_DESCRIPTION_LENGTH,
  isLevel,
  suggestLevel,
} from "@/lib/jobs/content";
import {
  deleteJob,
  insertJob,
  listJobs,
  saveJobQuestions,
  saveJobsPrep,
  setJobLevel,
} from "@/lib/jobs/data";
import { readJobs } from "@/lib/jobs/read";
import { readResumeFile } from "@/lib/jobs/resume";
import { MAX_REPORTS_LENGTH } from "@/lib/questions/content";
import { predictQuestions } from "@/lib/questions/predict";
import { normalize } from "@/lib/stories/upload";

export type FormState = { error?: string; notice?: string } | null;

// Adds a job from its pasted posting, then reads all the jobs again. If the read fails the job is
// still kept, and the jobs page offers to read again.
export async function addJob(_prev: FormState, formData: FormData): Promise<FormState> {
  const title = clean(formData.get("title")).slice(0, MAX_TITLE_LENGTH);
  const company = clean(formData.get("company")).slice(0, MAX_TITLE_LENGTH) || null;
  const description = normalize(String(formData.get("description") ?? ""));
  if (!title) return { error: "Add the job title." };
  if (description.length < MIN_DESCRIPTION_LENGTH) {
    return { error: "Paste the whole job posting, not just the title." };
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return {
      error: `Keep the posting under ${MAX_DESCRIPTION_LENGTH.toLocaleString("en-US")} characters.`,
    };
  }

  let id: string;
  try {
    if ((await listJobs()).length >= MAX_JOBS) {
      return { error: `You can keep up to ${MAX_JOBS} target jobs. Remove one to add another.` };
    }
    id = await insertJob({ title, company, level: suggestLevel(title), description });
  } catch (err) {
    unstable_rethrow(err);
    console.error("Target jobs: adding a job failed", err);
    return { error: err instanceof Error ? err.message : "The job couldn't be added. Try again." };
  }
  await readAfterChange();
  redirect(`/jobs/${id}`);
}

export async function removeJob(formData: FormData): Promise<void> {
  await deleteJob(String(formData.get("jobId") ?? ""));
  await readAfterChange();
  redirect("/jobs");
}

export async function confirmLevel(formData: FormData): Promise<void> {
  const level = formData.get("level");
  if (!isLevel(level)) return;
  await setJobLevel(String(formData.get("jobId") ?? ""), level);
  refresh();
}

// Saves an uploaded or pasted resume, then reads the jobs against it.
export async function saveResume(_prev: FormState, formData: FormData): Promise<FormState> {
  const file = formData.get("file");
  const pasted = normalize(String(formData.get("text") ?? ""));
  let text: string;
  let fileName = "";
  try {
    if (file instanceof File && file.size > 0) {
      text = await readResumeFile(file);
      fileName = file.name.slice(0, 200);
    } else if (pasted) {
      text = pasted.slice(0, MAX_RESUME_LENGTH);
    } else {
      return { error: "Choose a file or paste your resume first." };
    }
    await saveJobsPrep({ resume: { fileName, text, updatedAt: new Date().toISOString() } });
  } catch (err) {
    unstable_rethrow(err);
    return { error: err instanceof Error ? err.message : "The resume couldn't be saved." };
  }
  const read = await readAfterChange();
  refresh();
  return read;
}

export async function removeResume(): Promise<void> {
  await saveJobsPrep({ resume: null });
  await readAfterChange();
  refresh();
}

// Reads the jobs again, e.g. after a read failed.
export async function rereadJobs(): Promise<FormState> {
  const read = await readAfterChange();
  refresh();
  return read;
}

// Saves the interview reports the user pasted for a job (if any), then predicts its questions.
export async function predictLikelyQuestions(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const jobId = String(formData.get("jobId") ?? "");
  const reports = formData.get("reports");
  try {
    if (typeof reports === "string") {
      const text = normalize(reports);
      if (text.length > MAX_REPORTS_LENGTH) {
        return {
          error: `Keep the reports under ${MAX_REPORTS_LENGTH.toLocaleString("en-US")} characters.`,
        };
      }
      await saveJobQuestions(jobId, { interviewReports: text });
    }
    await predictQuestions(jobId);
  } catch (err) {
    unstable_rethrow(err);
    console.error("Likely questions: predicting failed", err);
    return {
      error:
        err instanceof ModelError
          ? "The assistant didn't respond. Try again in a moment."
          : err instanceof Error
            ? err.message
            : "The questions couldn't be predicted. Try again.",
    };
  }
  refresh();
  return null;
}

// The read is a model call, so it can fail; the change the user made is kept either way.
async function readAfterChange(): Promise<FormState> {
  try {
    await readJobs();
    return { notice: "Read your jobs." };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Target jobs: reading the jobs failed", err);
    return {
      error:
        err instanceof ModelError
          ? "Saved, but the assistant didn't respond while reading your jobs. Try reading them again."
          : "Saved, but your jobs couldn't be read just now. Try reading them again.",
    };
  }
}

function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

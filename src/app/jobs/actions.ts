"use server";

import { refresh } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { ModelError } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_JOBS,
  MAX_RESUME_LENGTH,
  MAX_TITLE_LENGTH,
  MIN_DESCRIPTION_LENGTH,
  isLevel,
  suggestLevel,
  titleFromPosting,
} from "@/lib/jobs/content";
import {
  deleteJob,
  insertJob,
  listJobs,
  saveJobQuestions,
  saveJobsPrep,
  setInterviewDate,
  setJobLevel,
  setJobOutcome,
} from "@/lib/jobs/data";
import {
  MAX_ROUND_NAME_LENGTH,
  isOutcome,
  openJobs,
  parseRound,
} from "@/lib/jobs/outcome";
import { fetchPosting } from "@/lib/jobs/fetch-posting";
import type { FetchedPosting } from "@/lib/jobs/posting-sources";
import { readJobs } from "@/lib/jobs/read";
import {
  readPostingPage,
  readPostingPdf,
  readPostingScreenshots,
} from "@/lib/jobs/read-posting-file";
import { readResumeFile } from "@/lib/jobs/resume";
import { isDate } from "@/lib/prep/plan";
import { MAX_REPORTS_LENGTH } from "@/lib/questions/content";
import { predictQuestions } from "@/lib/questions/predict";
import { normalize } from "@/lib/stories/upload";
import { trackEvent } from "@/lib/usage/track";

export type FormState = { error?: string; notice?: string } | null;

// Reads a posting from a link so the add-job form can fill itself in. Nothing is saved yet.
export async function fetchJobPosting(
  link: string,
): Promise<{ ok: true; posting: FetchedPosting } | { ok: false; error: string }> {
  try {
    await getCurrentUser();
    return { ok: true, posting: await fetchPosting(String(link)) };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Target jobs: fetching a posting failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "That posting couldn't be read." };
  }
}

// Reads a posting saved as a PDF, a web page or screenshots so the add-job form can fill itself
// in. The form unwraps and trims a saved page before sending its HTML. Nothing is saved yet.
export async function readJobPostingFile(
  formData: FormData,
): Promise<{ ok: true; posting: FetchedPosting } | { ok: false; error: string }> {
  try {
    await getCurrentUser();
    const kind = formData.get("kind");
    if (kind === "pdf") {
      const file = formData.get("file");
      if (!(file instanceof File)) return { ok: false, error: "Choose a PDF first." };
      return { ok: true, posting: await readPostingPdf(file) };
    }
    if (kind === "page") {
      return { ok: true, posting: await readPostingPage(String(formData.get("html") ?? "")) };
    }
    if (kind === "image") {
      const files = formData.getAll("image").filter((f): f is File => f instanceof File);
      return { ok: true, posting: await readPostingScreenshots(files) };
    }
    return { ok: false, error: "Upload a PDF, a saved web page or a screenshot." };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Target jobs: reading a posting file failed", err);
    return {
      ok: false,
      error:
        err instanceof ModelError
          ? "The assistant didn't respond. Try again in a moment."
          : err instanceof Error
            ? err.message
            : "That file couldn't be read.",
    };
  }
}

// Adds a job from its pasted posting, then reads all the jobs again and predicts its likely
// questions, so the user lands on them with nothing else to set up. If either model call fails the
// job is still kept, and its page offers to try again.
export async function addJob(_prev: FormState, formData: FormData): Promise<FormState> {
  let title = clean(formData.get("title")).slice(0, MAX_TITLE_LENGTH);
  const company = clean(formData.get("company")).slice(0, MAX_TITLE_LENGTH) || null;
  const description = normalize(String(formData.get("description") ?? ""));
  if (!description) {
    return { error: "Add a link to the posting, upload it, or paste its text." };
  }
  if (description.length < MIN_DESCRIPTION_LENGTH) {
    return { error: "Paste the whole job posting, not just the title." };
  }
  title ||= titleFromPosting(description).slice(0, MAX_TITLE_LENGTH);
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return {
      error: `Keep the posting under ${MAX_DESCRIPTION_LENGTH.toLocaleString("en-US")} characters.`,
    };
  }

  let id: string;
  try {
    if (openJobs(await listJobs()).length >= MAX_JOBS) {
      return {
        error: `You can have up to ${MAX_JOBS} target jobs in progress. Mark one finished or remove one to add another.`,
      };
    }
    const level = formData.get("level");
    const date = formData.get("interviewDate");
    const interviewDate = isDate(date) ? date : null;
    id = await insertJob({
      title,
      company,
      level: isLevel(level) ? level : suggestLevel(title),
      levelConfirmed: isLevel(level),
      description,
      interviewDate,
    });
    await trackEvent("job_added");
    if (interviewDate) await trackEvent("prep_plan_set");
  } catch (err) {
    unstable_rethrow(err);
    console.error("Target jobs: adding a job failed", err);
    return { error: err instanceof Error ? err.message : "The job couldn't be added. Try again." };
  }
  // Both are model calls; run side by side to keep the wait to one.
  await Promise.all([readAfterChange(), predictAfterAdd(id)]);
  redirect(`/jobs/${id}`);
}

async function predictAfterAdd(jobId: string): Promise<void> {
  try {
    await predictQuestions(jobId);
    await trackEvent("likely_questions_shown");
  } catch (err) {
    unstable_rethrow(err);
    console.error("Likely questions: predicting after adding a job failed", err);
  }
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

// Sets the date of the next interview for a job, which sizes the prep plan on home. "clear" removes it.
export async function saveInterviewDate(formData: FormData): Promise<void> {
  const jobId = String(formData.get("jobId") ?? "");
  const date = formData.get("date");
  if (formData.get("intent") === "clear") await setInterviewDate(jobId, null);
  else if (isDate(date)) {
    await setInterviewDate(jobId, date);
    await trackEvent("prep_plan_set");
  } else return;
  refresh();
}

// Marks a job's interview process finished with its outcome and the round reached, or reopens it
// ("reopen"). Editable any time.
export async function saveJobOutcome(formData: FormData): Promise<void> {
  const jobId = String(formData.get("jobId") ?? "");
  if (formData.get("intent") === "reopen") {
    await setJobOutcome(jobId, null);
    refresh();
    return;
  }
  const outcome = formData.get("outcome");
  if (!isOutcome(outcome)) return;
  const finished = formData.get("finishedOn");
  const wasOpen = formData.get("wasOpen") === "1";
  await setJobOutcome(jobId, {
    outcome,
    roundReached: parseRound(formData.get("round")),
    roundName: clean(formData.get("roundName")).slice(0, MAX_ROUND_NAME_LENGTH),
    finishedOn: isDate(finished) ? finished : null,
  });
  if (wasOpen) await trackEvent("job_finished");
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
    await trackEvent("likely_questions_shown");
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

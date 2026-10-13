"use server";

import { refresh } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { ModelError } from "@/lib/ai";
import { getJob } from "@/lib/jobs/data";
import { normalize } from "@/lib/stories/upload";
import { analyzeTranscript } from "@/lib/transcripts/analyze";
import {
  MAX_SPEAKER_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_TRANSCRIPTS,
  MAX_TRANSCRIPT_LENGTH,
  MIN_TRANSCRIPT_LENGTH,
} from "@/lib/transcripts/content";
import { deleteTranscript, insertTranscript, listTranscripts } from "@/lib/transcripts/data";
import { readTranscriptFile } from "@/lib/transcripts/read-file";

export type FormState = { error?: string } | null;

// Saves an uploaded or pasted transcript, then reviews it. If the review fails the transcript is
// still kept, and its page offers to review it again.
export async function addTranscript(_prev: FormState, formData: FormData): Promise<FormState> {
  const file = formData.get("file");
  const pasted = normalize(String(formData.get("text") ?? ""));
  const jobId = clean(formData.get("jobId")) || null;
  const speaker = clean(formData.get("speaker")).slice(0, MAX_SPEAKER_LENGTH);
  let title = clean(formData.get("title")).slice(0, MAX_TITLE_LENGTH);
  let company = clean(formData.get("company")).slice(0, MAX_TITLE_LENGTH) || null;

  let id: string;
  try {
    let text: string;
    let fileName = "";
    if (file instanceof File && file.size > 0) {
      text = await readTranscriptFile(file);
      fileName = file.name.slice(0, 200);
    } else if (pasted) {
      if (pasted.length > MAX_TRANSCRIPT_LENGTH) {
        return {
          error: `Keep it under ${MAX_TRANSCRIPT_LENGTH.toLocaleString("en-US")} characters: one interview at a time.`,
        };
      }
      text = pasted;
    } else {
      return { error: "Choose a file or paste the transcript first." };
    }
    if (text.length < MIN_TRANSCRIPT_LENGTH) {
      return { error: "That's too short to be a transcript. Add the whole conversation." };
    }

    const job = jobId ? await getJob(jobId) : null;
    if (jobId && !job) return { error: "That target job wasn't found." };
    company ??= job?.company ?? null;
    title ||= fileName.replace(/\.[a-z0-9]+$/i, "") || (company ? `Interview at ${company}` : "Interview");

    if ((await listTranscripts()).length >= MAX_TRANSCRIPTS) {
      return {
        error: `You can keep up to ${MAX_TRANSCRIPTS} transcripts. Remove one to add another.`,
      };
    }
    id = await insertTranscript({
      targetJobId: job?.id ?? null,
      title,
      company,
      speaker,
      fileName,
      transcript: text,
    });
  } catch (err) {
    unstable_rethrow(err);
    console.error("Transcripts: adding a transcript failed", err);
    return { error: err instanceof Error ? err.message : "The transcript couldn't be saved." };
  }

  try {
    await analyzeTranscript(id);
  } catch (err) {
    unstable_rethrow(err);
    // The transcript is saved; its page says it hasn't been reviewed and offers to try again.
    console.error("Transcripts: reviewing a new transcript failed", err);
  }
  redirect(`/transcripts/${id}`);
}

export async function reviewAgain(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await analyzeTranscript(String(formData.get("transcriptId") ?? ""));
  } catch (err) {
    unstable_rethrow(err);
    console.error("Transcripts: reviewing failed", err);
    return {
      error:
        err instanceof ModelError
          ? "The assistant didn't respond. Try again in a moment."
          : err instanceof Error
            ? err.message
            : "The transcript couldn't be reviewed. Try again.",
    };
  }
  refresh();
  return null;
}

export async function removeTranscript(formData: FormData): Promise<void> {
  await deleteTranscript(String(formData.get("transcriptId") ?? ""));
  redirect("/transcripts");
}

function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

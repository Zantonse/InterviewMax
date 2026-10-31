"use server";

import { refresh } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { ModelError } from "@/lib/ai";
import { isRound } from "@/lib/bank/content";
import {
  leaveOutSharedQuestion,
  syncSharedQuestionsSafely,
  withdrawSharedQuestions,
} from "@/lib/bank/data";
import { getJob } from "@/lib/jobs/data";
import { predictAfterTranscript } from "@/lib/questions/predict";
import { normalize } from "@/lib/stories/upload";
import { analyzeTranscript, labelSpeakers } from "@/lib/transcripts/analyze";
import {
  MAX_FILE_TEXT_LENGTH,
  MAX_SPEAKER_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_TRANSCRIPTS,
  MAX_TRANSCRIPT_LENGTH,
  MIN_TRANSCRIPT_LENGTH,
} from "@/lib/transcripts/content";
import {
  deleteTranscript,
  getTranscript,
  insertTranscript,
  listTranscripts,
  saveLabelledTranscript,
  saveSharing,
} from "@/lib/transcripts/data";
import {
  AUTO_SPEAKER,
  labelledTranscript,
  relabel,
  turnsFromLabelled,
  type SpeakerRole,
} from "@/lib/transcripts/speakers";
import { readTranscriptFile } from "@/lib/transcripts/read-file";
import { partTitle, splitInterviews, type LeftOut } from "@/lib/transcripts/split";
import { trackEvent } from "@/lib/usage/track";

export type FormState = { error?: string } | null;

// Saves an uploaded or pasted transcript, then reviews it. A file with several interviews in it
// ("Interview 1", "Interview 2") is saved as one past interview each, and a job description or
// feedback notes pasted in with them are left out (see split.ts). If a review fails the
// transcript is still kept, and its page offers to review it again.
export async function addTranscript(_prev: FormState, formData: FormData): Promise<FormState> {
  const file = formData.get("file");
  const pasted = normalize(String(formData.get("text") ?? ""));
  const jobId = clean(formData.get("jobId")) || null;
  const speaker = clean(formData.get("speaker")).slice(0, MAX_SPEAKER_LENGTH);
  let title = clean(formData.get("title")).slice(0, MAX_TITLE_LENGTH);
  let company = clean(formData.get("company")).slice(0, MAX_TITLE_LENGTH) || null;
  // Shared question bank: off unless ticked.
  const share = formData.get("share") === "on";
  const roundValue = clean(formData.get("round"));
  const round = isRound(roundValue) ? roundValue : null;

  const ids: string[] = [];
  let leftOut: LeftOut[] = [];
  try {
    let text: string;
    let fileName = "";
    if (file instanceof File && file.size > 0) {
      text = await readTranscriptFile(file);
      fileName = file.name.slice(0, 200);
    } else if (pasted) {
      if (pasted.length > MAX_FILE_TEXT_LENGTH) {
        return {
          error: `Keep it under ${MAX_FILE_TEXT_LENGTH.toLocaleString("en-US")} characters. Paste a few interviews at a time.`,
        };
      }
      text = pasted;
    } else {
      return { error: "Choose a file or paste the transcript first." };
    }
    if (text.length < MIN_TRANSCRIPT_LENGTH) {
      return { error: "That's too short to be a transcript. Add the whole conversation." };
    }
    const split = splitInterviews(text);
    leftOut = split.leftOut;
    const parts = split.interviews;
    if (parts.length === 0) {
      return {
        error: "That reads like a job description or feedback notes, not an interview. Add the conversation itself.",
      };
    }
    const tooLong = parts.find((p) => p.text.length > MAX_TRANSCRIPT_LENGTH);
    if (tooLong) {
      return {
        error: `${parts.length > 1 ? `"${tooLong.label}"` : "That interview"} is over ${MAX_TRANSCRIPT_LENGTH.toLocaleString("en-US")} characters. Split it into parts, each headed "Interview 1", "Interview 2" and so on.`,
      };
    }

    const job = jobId ? await getJob(jobId) : null;
    if (jobId && !job) return { error: "That target job wasn't found." };
    company ??= job?.company ?? null;
    title ||= fileName.replace(/\.[a-z0-9]+$/i, "") || (company ? `Interview at ${company}` : "Interview");

    const kept = (await listTranscripts()).length;
    if (kept + parts.length > MAX_TRANSCRIPTS) {
      return {
        error:
          parts.length > 1
            ? `That file has ${parts.length} interviews and you can keep up to ${MAX_TRANSCRIPTS}. Remove ${kept + parts.length - MAX_TRANSCRIPTS} to add them.`
            : `You can keep up to ${MAX_TRANSCRIPTS} transcripts. Remove one to add another.`,
      };
    }
    for (const part of parts) {
      ids.push(
        await insertTranscript({
          targetJobId: job?.id ?? null,
          title: partTitle(title, part, parts.length),
          company,
          speaker,
          fileName,
          transcript: part.text,
          shareQuestions: share,
          // The round picked applies to a single interview; a file of several has more than one.
          round: parts.length === 1 ? round : null,
        }),
      );
      await trackEvent("transcript_added");
    }
    if (share) await trackEvent("questions_shared");
  } catch (err) {
    unstable_rethrow(err);
    console.error("Transcripts: adding a transcript failed", err);
    if (ids.length > 0) redirect("/transcripts");
    return { error: err instanceof Error ? err.message : "The transcript couldn't be saved." };
  }

  // Each interview is marked and reviewed on its own, side by side.
  await Promise.all(
    ids.map(async (id) => {
      try {
        // With no speaker names, mark who said what first; the review reads the labelled version.
        await labelSpeakers(id);
      } catch (err) {
        unstable_rethrow(err);
        console.error("Transcripts: marking who said what failed", err);
      }
      try {
        await analyzeTranscript(id);
        await syncSharedQuestionsSafely(id);
      } catch (err) {
        unstable_rethrow(err);
        // The transcript is saved; its page says it hasn't been reviewed and offers to try again.
        console.error("Transcripts: reviewing a new transcript failed", err);
      }
    }),
  );
  try {
    await predictAfterTranscript({ targetJobId: jobId, company });
  } catch (err) {
    unstable_rethrow(err);
    console.error("Transcripts: predicting after a new transcript failed", err);
  }
  const left = leftOut.length > 0 ? `left=${leftOut.join(",")}` : "";
  if (ids.length === 1) redirect(`/transcripts/${ids[0]}${left ? `?${left}` : ""}`);
  redirect(`/transcripts?added=${ids.length}${left ? `&${left}` : ""}`);
}

export async function reviewAgain(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const id = String(formData.get("transcriptId") ?? "");
    // One saved without marking who said what (no speaker names, and the marking failed or never
    // ran) gets marked first, so the review and "How sure you sounded" read the user's own turns.
    try {
      await labelSpeakers(id);
    } catch (err) {
      unstable_rethrow(err);
      console.error("Transcripts: marking who said what failed", err);
    }
    await analyzeTranscript(id);
    await syncSharedQuestionsSafely(id);
    const transcript = await getTranscript(id);
    if (transcript) await predictAfterTranscript(transcript);
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

// The user's fixes to who said what, one speaker per turn in order, then the review runs again.
export async function relabelTranscript(
  transcriptId: string,
  speakers: SpeakerRole[],
): Promise<FormState> {
  try {
    const transcript = await getTranscript(String(transcriptId));
    if (!transcript) return { error: "That transcript wasn't found." };
    const turns = turnsFromLabelled(transcript.transcript);
    if (turns.length === 0) return { error: "This transcript isn't split into turns." };
    const roles = Array.isArray(speakers)
      ? speakers.map((s): SpeakerRole => (s === "me" ? "me" : "interviewer"))
      : [];
    await saveLabelledTranscript(
      transcript.id,
      labelledTranscript(relabel(turns, roles)),
      AUTO_SPEAKER,
    );
    await analyzeTranscript(transcript.id);
    await syncSharedQuestionsSafely(transcript.id);
    await predictAfterTranscript(transcript);
  } catch (err) {
    unstable_rethrow(err);
    console.error("Transcripts: relabelling failed", err);
    return {
      error:
        err instanceof ModelError
          ? "Saved. The review didn't finish, so try Review again in a moment."
          : err instanceof Error
            ? err.message
            : "That didn't save. Try again.",
    };
  }
  refresh();
  return null;
}

// Shared question bank: turns sharing on for an interview already added, with its round.
export async function shareQuestions(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const transcript = await getTranscript(String(formData.get("transcriptId") ?? ""));
    if (!transcript) return { error: "That transcript wasn't found." };
    const roundValue = clean(formData.get("round"));
    await saveSharing(transcript.id, {
      shareQuestions: true,
      round: isRound(roundValue) ? roundValue : null,
    });
    await syncSharedQuestionsSafely(transcript.id);
    await trackEvent("questions_shared");
  } catch (err) {
    unstable_rethrow(err);
    console.error("Transcripts: sharing questions failed", err);
    return { error: err instanceof Error ? err.message : "That didn't save. Try again." };
  }
  refresh();
  return null;
}

// Interview timeline: sets which round an interview was, without touching whether it's shared.
// A shared interview's questions carry the round, so they're synced again.
export async function setRound(formData: FormData): Promise<void> {
  const transcript = await getTranscript(String(formData.get("transcriptId") ?? ""));
  if (!transcript) return;
  const roundValue = clean(formData.get("round"));
  const round = isRound(roundValue) ? roundValue : null;
  if (round === transcript.round) return;
  await saveSharing(transcript.id, { round });
  if (transcript.shareQuestions) await syncSharedQuestionsSafely(transcript.id);
  refresh();
}

// Stops sharing and deletes every question already shared from this interview.
export async function withdrawQuestions(formData: FormData): Promise<void> {
  await withdrawSharedQuestions(String(formData.get("transcriptId") ?? ""));
  refresh();
}

// Leaves one question out of the bank for good.
export async function leaveOutQuestion(formData: FormData): Promise<void> {
  await leaveOutSharedQuestion(
    String(formData.get("transcriptId") ?? ""),
    String(formData.get("questionId") ?? ""),
  );
  refresh();
}

export async function removeTranscript(formData: FormData): Promise<void> {
  await deleteTranscript(String(formData.get("transcriptId") ?? ""));
  redirect("/transcripts");
}

function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

import "server-only";
import { generateForStep } from "@/lib/ai";
import { getJob } from "@/lib/jobs/data";
import type { TranscriptAnalysis } from "./content";
import { getTranscript, saveAnalysis, saveLabelledTranscript } from "./data";
import { TRANSCRIPT_READ_SYSTEM, parseTranscriptReply, transcriptReadMessages } from "./prompts";
import {
  AUTO_SPEAKER,
  TRANSCRIPT_SPEAKERS_SYSTEM,
  hasSpeakerLabels,
  labelledTranscript,
  parseSpeakerTurns,
  transcriptSpeakersMessages,
} from "./speakers";

// Reviews one transcript and saves the review on it.
export async function analyzeTranscript(id: string): Promise<TranscriptAnalysis> {
  const transcript = await getTranscript(id);
  if (!transcript) throw new Error("Transcript not found.");
  const job = transcript.targetJobId ? await getJob(transcript.targetJobId) : null;

  const result = await generateForStep("transcriptRead", {
    system: TRANSCRIPT_READ_SYSTEM,
    messages: transcriptReadMessages({ ...transcript, job }),
  });
  if (result.stopReason === "refusal") throw new Error("The model declined to review this transcript.");
  if (result.stopReason === "max_tokens" && !result.text.includes("}")) {
    throw new Error("The review ran out of room before finishing. Try again.");
  }

  const analysis: TranscriptAnalysis = {
    ...parseTranscriptReply(result.text, transcript.transcript),
    model: result.model,
    analyzedAt: new Date().toISOString(),
  };
  await saveAnalysis(transcript.id, analysis);
  return analysis;
}

// When a transcript doesn't say who is speaking, marks each turn as the interviewer's or the
// user's and saves it labelled, with "Me" as the user's speaker. Returns false (and changes
// nothing) when it already has names, the user said which speaker they are, or the turns didn't
// come back usable.
export async function labelSpeakers(id: string): Promise<boolean> {
  const transcript = await getTranscript(id);
  if (!transcript) throw new Error("Transcript not found.");
  if (transcript.speaker || hasSpeakerLabels(transcript.transcript)) return false;
  const job = transcript.targetJobId ? await getJob(transcript.targetJobId) : null;

  const result = await generateForStep("transcriptSpeakers", {
    system: TRANSCRIPT_SPEAKERS_SYSTEM,
    messages: transcriptSpeakersMessages({ transcript: transcript.transcript, job }),
  });
  if (result.stopReason === "refusal") return false;
  const turns = parseSpeakerTurns(result.text, transcript.transcript);
  // One side only means the split didn't work; leave the transcript as it was.
  if (!turns.some((t) => t.speaker === "me") || !turns.some((t) => t.speaker === "interviewer")) {
    return false;
  }
  await saveLabelledTranscript(transcript.id, labelledTranscript(turns), AUTO_SPEAKER);
  return true;
}

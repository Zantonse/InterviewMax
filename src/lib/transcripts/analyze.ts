import "server-only";
import { generateForStep } from "@/lib/ai";
import { getJob } from "@/lib/jobs/data";
import type { TranscriptAnalysis } from "./content";
import { getTranscript, saveAnalysis } from "./data";
import { TRANSCRIPT_READ_SYSTEM, parseTranscriptReply, transcriptReadMessages } from "./prompts";

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

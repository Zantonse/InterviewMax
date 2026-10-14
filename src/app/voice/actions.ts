"use server";

import { unstable_rethrow } from "next/navigation";
import { ModelError } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth";
import { transcribeWav } from "@/lib/voice/transcribe";

export type TranscribeResult = { ok: true; text: string } | { ok: false; error: string };

// Mic mode: writes down one recorded piece of an answer. Called by the mic button while the user
// talks; nothing is stored, and the text lands in the answer box to check before sending.
export async function transcribeAudio(formData: FormData): Promise<TranscribeResult> {
  try {
    await getCurrentUser();
    const audio = formData.get("audio");
    if (!(audio instanceof Blob)) return { ok: false, error: "No recording came through." };
    return { ok: true, text: await transcribeWav(audio) };
  } catch (err) {
    // redirect() (signed out) throws a control-flow error that must propagate.
    unstable_rethrow(err);
    console.error("Transcription failed", err);
    if (err instanceof ModelError) {
      return { ok: false, error: "Couldn't write down what you said. Try again, or type it." };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

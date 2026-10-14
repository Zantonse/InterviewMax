import "server-only";
import { transcribeForStep } from "@/lib/ai";
import { cleanTranscript } from "./text";
import { MAX_CHUNK_BYTES, isWav } from "./wav";

// Writes down one recorded piece of an answer (WAV from the mic button). Throws an Error whose
// message can be shown to the user, or a ModelError when the model call fails.
export async function transcribeWav(audio: Blob): Promise<string> {
  if (audio.size === 0) return "";
  if (audio.size > MAX_CHUNK_BYTES) throw new Error("That recording piece was too long to send.");
  const bytes = new Uint8Array(await audio.arrayBuffer());
  if (!isWav(bytes)) throw new Error("That recording couldn't be read. Try again.");
  return cleanTranscript(await transcribeForStep("transcribe", bytes));
}

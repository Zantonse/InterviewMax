import "server-only";
import { generateForStep } from "@/lib/ai";
import { TRANSCRIBE_INSTRUCTION, TRANSCRIBE_SYSTEM, cleanTranscript } from "./prompts";
import { MAX_CHUNK_BYTES, isWav } from "./wav";

// Writes down one recorded piece of an answer (WAV from the mic button). Throws an Error whose
// message can be shown to the user, or a ModelError when the model call fails.
export async function transcribeWav(audio: Blob): Promise<string> {
  if (audio.size === 0) return "";
  if (audio.size > MAX_CHUNK_BYTES) throw new Error("That recording piece was too long to send.");
  const bytes = new Uint8Array(await audio.arrayBuffer());
  if (!isWav(bytes)) throw new Error("That recording couldn't be read. Try again.");

  const result = await generateForStep("transcribe", {
    system: TRANSCRIBE_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: TRANSCRIBE_INSTRUCTION },
          { type: "audio", format: "wav", data: Buffer.from(bytes).toString("base64") },
        ],
      },
    ],
  });
  return cleanTranscript(result.text);
}

import "server-only";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { normalize } from "@/lib/stories/upload";
import { MAX_UPLOAD_BYTES } from "@/lib/stories/story-types";
import { MAX_TRANSCRIPT_LENGTH, TRANSCRIPT_EXTENSIONS, captionsToText } from "./content";

// Reads the text of an interview transcript from a PDF, Word (.docx), text, or caption file
// (.vtt or .srt, as Zoom, Teams and Meet export them).
// Throws an Error whose message can be shown to the user.
export async function readTranscriptFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".doc")) {
    throw new Error("Older .doc files can't be read. Save it as .docx or PDF and try again.");
  }
  if (!TRANSCRIPT_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    throw new Error("Upload a PDF, Word (.docx), text, or caption (.vtt or .srt) file.");
  }
  if (file.size === 0) throw new Error("That file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Keep the file under 3 MB.");

  let text: string;
  try {
    if (name.endsWith(".pdf")) {
      const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
      text = (await extractText(pdf, { mergePages: true })).text;
    } else if (name.endsWith(".docx")) {
      text = (await mammoth.extractRawText({ buffer: Buffer.from(await file.arrayBuffer()) })).value;
    } else if (name.endsWith(".vtt") || name.endsWith(".srt")) {
      text = captionsToText(await file.text());
    } else {
      text = await file.text();
    }
  } catch {
    throw new Error("That file couldn't be read. Try saving it again, or paste the text instead.");
  }

  text = normalize(text);
  if (!text) {
    throw new Error("There's no text in that file. If it's a scanned PDF, paste the text instead.");
  }
  if (text.length > MAX_TRANSCRIPT_LENGTH) {
    throw new Error(
      `That transcript is over ${MAX_TRANSCRIPT_LENGTH.toLocaleString("en-US")} characters. Upload one interview at a time.`,
    );
  }
  return text;
}

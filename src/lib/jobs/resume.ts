import "server-only";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { normalize } from "@/lib/stories/upload";
import { MAX_UPLOAD_BYTES } from "@/lib/stories/story-types";
import { MAX_RESUME_LENGTH, RESUME_EXTENSIONS } from "./content";

// Reads the text of a resume from a PDF, Word (.docx) or text file.
// Throws an Error whose message can be shown to the user.
export async function readResumeFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".doc")) {
    throw new Error("Older .doc files can't be read. Save it as .docx or PDF and try again.");
  }
  if (!RESUME_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    throw new Error("Upload a PDF, Word (.docx) or text file.");
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
  // A long resume is still useful; keep the top, where the recent roles are.
  return text.slice(0, MAX_RESUME_LENGTH);
}

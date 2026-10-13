import "server-only";
import mammoth from "mammoth";
import { MAX_IMPORTED_LENGTH, MAX_UPLOAD_BYTES, UPLOAD_EXTENSIONS } from "./story-types";

// Reads the text of a prepared "Tell me about yourself" answer from a Word (.docx) or text file.
// Throws an Error whose message can be shown to the user.
export async function readUploadedAnswer(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".doc")) {
    throw new Error("Older .doc files can't be read. Save it as .docx or .txt and try again.");
  }
  if (!UPLOAD_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    throw new Error("Upload a Word (.docx) or text (.txt) file.");
  }
  if (file.size === 0) throw new Error("That file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Keep the file under 3 MB.");

  let text: string;
  if (name.endsWith(".docx")) {
    try {
      const result = await mammoth.extractRawText({
        buffer: Buffer.from(await file.arrayBuffer()),
      });
      text = result.value;
    } catch {
      throw new Error("That Word file couldn't be read. Try saving it again, or as .txt.");
    }
  } else {
    text = await file.text();
  }

  text = normalize(text);
  if (!text) throw new Error("There's no text in that file.");
  if (text.length > MAX_IMPORTED_LENGTH) {
    throw new Error(
      `That file has more than ${MAX_IMPORTED_LENGTH.toLocaleString("en-US")} characters. Upload just your "Tell me about yourself" answer.`,
    );
  }
  return text;
}

// Collapses the blank lines and trailing spaces Word exports tend to carry.
export function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

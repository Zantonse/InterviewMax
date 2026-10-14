import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import { generateForStep } from "@/lib/ai";
import { MAX_UPLOAD_BYTES } from "@/lib/stories/story-types";
import { normalize } from "@/lib/stories/upload";
import { MAX_DESCRIPTION_LENGTH, MIN_DESCRIPTION_LENGTH } from "./content";
import { POSTING_EXTRACT_SYSTEM, parsePostingExtract, postingExtractMessages } from "./posting-pdf";
import type { FetchedPosting } from "./posting-sources";

// The PDF text sent to the model; a saved job page is rarely longer than this.
const MAX_PDF_TEXT = 40000;

// Reads a job posting saved as PDF. Throws an Error whose message can be shown to the user.
export async function readPostingPdf(file: File): Promise<FetchedPosting> {
  if (!file.name.toLowerCase().endsWith(".pdf")) throw new Error("Upload the posting as a PDF.");
  if (file.size === 0) throw new Error("That file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Keep the file under 3 MB.");

  let text: string;
  try {
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    text = normalize((await extractText(pdf, { mergePages: true })).text).slice(0, MAX_PDF_TEXT);
  } catch {
    throw new Error("That PDF couldn't be read. Try saving it again.");
  }
  if (text.length < MIN_DESCRIPTION_LENGTH) {
    throw new Error(
      "There's no text in that PDF. If it was saved as an image, copy the posting's text and paste it below instead.",
    );
  }

  // If the model can't pick the posting out, the whole text still fills the form to tidy by hand.
  const whole: FetchedPosting = { title: "", company: "", description: text.slice(0, MAX_DESCRIPTION_LENGTH) };
  try {
    const result = await generateForStep("postingExtract", {
      system: POSTING_EXTRACT_SYSTEM,
      messages: postingExtractMessages(text),
    });
    const found = parsePostingExtract(result.text, text);
    return found && found.description.length >= MIN_DESCRIPTION_LENGTH ? found : whole;
  } catch (err) {
    console.error("Target jobs: picking the posting out of a PDF failed", err);
    return whole;
  }
}

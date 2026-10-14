import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import { generateForStep } from "@/lib/ai";
import { MAX_UPLOAD_BYTES } from "@/lib/stories/story-types";
import { normalize } from "@/lib/stories/upload";
import { MAX_DESCRIPTION_LENGTH, MIN_DESCRIPTION_LENGTH } from "./content";
import {
  MAX_PAGE_HTML,
  MAX_SCREENSHOTS_BYTES,
  MAX_SCREENSHOT_TILES,
  POSTING_EXTRACT_SYSTEM,
  POSTING_SCREENSHOT_SYSTEM,
  parsePostingExtract,
  parsePostingScreenshot,
  postingExtractMessages,
  postingScreenshotMessages,
} from "./posting-file";
import { htmlToText, jobPostingLd, type FetchedPosting } from "./posting-sources";

// The text sent to the model; a saved job page is rarely longer than this.
const MAX_SOURCE_TEXT = 40000;

// Reads a job posting saved as PDF. Throws an Error whose message can be shown to the user.
export async function readPostingPdf(file: File): Promise<FetchedPosting> {
  if (!file.name.toLowerCase().endsWith(".pdf")) throw new Error("Upload the posting as a PDF.");
  if (file.size === 0) throw new Error("That file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Keep the file under 3 MB.");

  let text: string;
  try {
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    text = normalize((await extractText(pdf, { mergePages: true })).text).slice(0, MAX_SOURCE_TEXT);
  } catch {
    throw new Error("That PDF couldn't be read. Try saving it again.");
  }
  if (text.length < MIN_DESCRIPTION_LENGTH) {
    throw new Error(
      "There's no text in that PDF. If it was saved as an image, upload it as a screenshot instead.",
    );
  }
  return pickPosting(text, "PDF");
}

// Reads a job page saved from the browser, already unwrapped and trimmed by the form.
export async function readPostingPage(html: string): Promise<FetchedPosting> {
  if (html.length > MAX_PAGE_HTML) throw new Error("That page is too large to read.");
  // The site's own JobPosting data is the posting as published; use it when the page has it.
  const ld = jobPostingLd(html);
  if (ld && ld.description.length >= MIN_DESCRIPTION_LENGTH) {
    return {
      ...ld,
      description: ld.description.slice(0, MAX_DESCRIPTION_LENGTH),
    };
  }
  const body = html.match(/<body[\s>][\s\S]*?<\/body>/i)?.[0] ?? html;
  const text = normalize(htmlToText(body)).slice(0, MAX_SOURCE_TEXT);
  if (text.length < MIN_DESCRIPTION_LENGTH) {
    throw new Error(
      "There's no posting text in that page. Some sites only fill it in while it's open: take screenshots of the posting and upload those instead.",
    );
  }
  return pickPosting(text, "web page");
}

// The model picks the posting out of the text; only lines found in the text are kept. If it can't,
// the whole text still fills the form to tidy by hand.
async function pickPosting(text: string, from: "PDF" | "web page"): Promise<FetchedPosting> {
  const whole: FetchedPosting = {
    title: "",
    company: "",
    description: text.slice(0, MAX_DESCRIPTION_LENGTH),
  };
  try {
    const result = await generateForStep("postingExtract", {
      system: POSTING_EXTRACT_SYSTEM,
      messages: postingExtractMessages(text, from),
    });
    const found = parsePostingExtract(result.text, text);
    return found && found.description.length >= MIN_DESCRIPTION_LENGTH ? found : whole;
  } catch (err) {
    console.error(`Target jobs: picking the posting out of a ${from} failed`, err);
    return whole;
  }
}

// Copies a posting's text out of screenshots with a model that can see images.
export async function readPostingScreenshots(files: File[]): Promise<FetchedPosting> {
  if (files.length === 0) throw new Error("Choose a screenshot first.");
  if (files.length > MAX_SCREENSHOT_TILES) {
    throw new Error(`Upload up to ${MAX_SCREENSHOT_TILES} screenshots.`);
  }
  if (files.reduce((sum, f) => sum + f.size, 0) > MAX_SCREENSHOTS_BYTES) {
    throw new Error("Those screenshots are too large together. Try fewer of them.");
  }
  const images = await Promise.all(
    files.map(async (file) => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mediaType = imageType(bytes);
      if (!mediaType) throw new Error("Upload screenshots as PNG, JPEG or WebP images.");
      return { mediaType, data: Buffer.from(bytes).toString("base64") };
    }),
  );

  const result = await generateForStep("postingScreenshot", {
    system: POSTING_SCREENSHOT_SYSTEM,
    messages: postingScreenshotMessages(images),
  });
  const found = parsePostingScreenshot(result.text);
  if (!found || found.description.length < MIN_DESCRIPTION_LENGTH) {
    throw new Error(
      "I couldn't read a job posting in that screenshot. Make sure the posting's text is on screen and try again, or paste it below.",
    );
  }
  return found;
}

// Checks the file's first bytes, not its name or the type the browser claims.
function imageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  const at = (i: number, ...values: number[]) => values.every((v, j) => bytes[i + j] === v);
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  return null;
}

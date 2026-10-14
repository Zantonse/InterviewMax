import type { ChatMessage, ContentPart } from "@/lib/ai/types";
import { extractJson } from "@/lib/stories/prompts";
import { MAX_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH, isRecord } from "./content";
import type { FetchedPosting } from "./posting-sources";

// A job posting saved from a site whose links can't be read (LinkedIn, Indeed, Glassdoor): as a
// PDF, as a web page (.html, or .mhtml from Chrome's "Save as… single file"), or as screenshots.

export const POSTING_FILE_ACCEPT =
  ".pdf,application/pdf,.html,.htm,.mhtml,.mht,text/html,.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";

export type PostingFileKind = "pdf" | "page" | "image";

export function postingFileKind(name: string): PostingFileKind | null {
  const ext = name.toLowerCase().match(/\.([a-z]+)$/)?.[1] ?? "";
  if (ext === "pdf") return "pdf";
  if (["html", "htm", "mhtml", "mht"].includes(ext)) return "page";
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) return "image";
  return null;
}

// Screenshots are cut into tiles this many at most, so a long page stays readable to the model.
export const MAX_SCREENSHOT_TILES = 8;
// All the tiles together, under the 4 MB request limit.
export const MAX_SCREENSHOTS_BYTES = 3.5 * 1024 * 1024;
// A saved page is trimmed in the browser before upload; this is what may reach the server.
export const MAX_PAGE_HTML = 3 * 1024 * 1024;

// ---- Saved web pages ----

// The HTML of a saved page. An .mhtml file wraps it in a MIME message, usually quoted-printable.
export function savedPageHtml(name: string, raw: string): string {
  return /\.mht(ml)?$/i.test(name) ? (mhtmlHtml(raw) ?? "") : raw;
}

function mhtmlHtml(raw: string): string | null {
  const boundary = raw.match(/boundary="?([^"\r\n;]+)"?/i)?.[1];
  const parts = boundary ? raw.split(`--${boundary}`) : [raw];
  for (const part of parts) {
    const split = part.search(/\r?\n\r?\n/);
    if (split < 0) continue;
    const headers = part.slice(0, split);
    if (!/content-type:\s*text\/html/i.test(headers)) continue;
    const body = part.slice(split).replace(/^\r?\n\r?\n/, "");
    const encoding = headers.match(/content-transfer-encoding:\s*([\w-]+)/i)?.[1]?.toLowerCase();
    if (encoding === "quoted-printable") return decodeQuotedPrintable(body);
    if (encoding === "base64") return utf8(base64Bytes(body.replace(/\s+/g, "")));
    return body;
  }
  return null;
}

export function decodeQuotedPrintable(text: string): string {
  const joined = text.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < joined.length; i++) {
    const hex = joined[i] === "=" ? joined.slice(i + 1, i + 3) : "";
    if (/^[0-9a-f]{2}$/i.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else {
      // Characters outside ASCII aren't expected in quoted-printable, but keep them if present.
      bytes.push(...new TextEncoder().encode(joined[i]));
    }
  }
  return utf8(Uint8Array.from(bytes));
}

function base64Bytes(b64: string): Uint8Array {
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function utf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

// Drops what a saved page carries besides its text (scripts, styles, icons, attributes), so a
// several-megabyte page fits in one upload. The site's JobPosting data (JSON-LD) is kept.
export function slimHtml(html: string): string {
  return html
    .replace(/<script\b(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<(style|svg|noscript|template|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(link|img|source|input|path)\b[^>]*>/gi, "")
    .replace(
      /\s(?:class|style|id|role|tabindex|href|src|srcset|sizes|width|height|loading|target|rel|data-[\w-]+|aria-[\w-]+|on\w+)=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
      "",
    )
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n\s*\n+/g, "\n");
}

// ---- Picking the posting out of a PDF's or page's text ----

// The text carries the site's menus and "similar jobs" around the posting, so one model call
// ("postingExtract") picks out the posting. Every line it returns must appear in the text; the
// rest are dropped, so nothing is reworded or invented.

export const POSTING_EXTRACT_SYSTEM = `You are given the text of a job posting saved (as a PDF or a web page) from a job site such as LinkedIn or Indeed. Besides the posting, the text usually contains the site's menus, buttons, ads, applicant counts and lists of other jobs.

Return the job title, the hiring company, and the posting itself: the description, responsibilities, requirements, qualifications, benefits, salary and location, in their original order.

The hard rule: copy the posting's lines exactly as they appear in the text, one line per line. Don't reword, summarise, fix or add anything. Leave out everything that isn't part of this one posting (site menus, "Apply" and "Save" buttons, applicant counts, "people also viewed", other jobs, cookie and sign-in notices).

If there's no job posting in the text, return empty strings.

Reply with JSON only, no other text:
{"title": "…", "company": "…", "lines": ["…"]}`;

export function postingExtractMessages(
  sourceText: string,
  from: "PDF" | "web page" = "PDF",
): ChatMessage[] {
  return [
    {
      role: "user",
      content: `Here is the text of the saved ${from}.\n\n${sourceText}`,
    },
  ];
}

// Compares lines ignoring spacing and case, so a line still matches when the PDF broke it oddly.
function key(line: string): string {
  return line
    .toLowerCase()
    .replace(/[\s ]+/g, " ")
    .trim();
}

export function parsePostingExtract(text: string, sourceText: string): FetchedPosting | null {
  const json = extractJson(text);
  if (!isRecord(json)) return null;
  const source = key(sourceText);
  const inSource = (line: string) => line !== "" && source.includes(key(line));
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const lines = (Array.isArray(json.lines) ? json.lines : []).map(str).filter(inSource);
  const title = str(json.title);
  const company = str(json.company);
  if (lines.length === 0) return null;
  return {
    title: inSource(title) ? title.slice(0, MAX_TITLE_LENGTH) : "",
    company: inSource(company) ? company.slice(0, MAX_TITLE_LENGTH) : "",
    description: lines.join("\n").slice(0, MAX_DESCRIPTION_LENGTH),
  };
}

// ---- Screenshots ----

// One model call ("postingScreenshot") copies the posting's text out of the screenshots. There's no
// text to check its lines against, so the form says to check them over before adding the job.

export const POSTING_SCREENSHOT_SYSTEM = `You are given screenshots of a job posting on a job site such as LinkedIn or Indeed. They are consecutive parts of one page, in order, and neighbouring images may overlap by a few lines.

Return the job title, the hiring company, and the posting itself: the description, responsibilities, requirements, qualifications, benefits, salary and location, in their original order.

The hard rule: copy only text you can actually see in the images, exactly as written, one line per line. Don't reword, summarise, fix, complete or add anything, and don't guess at text that is cut off or unreadable: leave it out. Where images overlap, copy the overlapping lines once. Leave out everything that isn't part of this one posting (site menus, "Apply" and "Save" buttons, applicant counts, "people also viewed", other jobs, cookie and sign-in notices).

If there's no job posting in the images, return empty strings.

Reply with JSON only, no other text:
{"title": "…", "company": "…", "lines": ["…"]}`;

export function postingScreenshotMessages(
  images: {
    mediaType: "image/jpeg" | "image/png" | "image/webp";
    data: string;
  }[],
): ChatMessage[] {
  const content: ContentPart[] = [
    ...images.map((image) => ({ type: "image" as const, ...image })),
    {
      type: "text",
      text: `Here ${images.length === 1 ? "is the screenshot" : `are the ${images.length} screenshots, in order`}. Copy out the posting.`,
    },
  ];
  return [{ role: "user", content }];
}

export function parsePostingScreenshot(text: string): FetchedPosting | null {
  const json = extractJson(text);
  if (!isRecord(json)) return null;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  // Overlapping screenshots can repeat a line; drop a line that repeats the one before it.
  const lines = (Array.isArray(json.lines) ? json.lines : [])
    .map(str)
    .filter((line, i, all) => line !== "" && key(line) !== key(all[i - 1] ?? ""));
  if (lines.length === 0) return null;
  return {
    title: str(json.title).slice(0, MAX_TITLE_LENGTH),
    company: str(json.company).slice(0, MAX_TITLE_LENGTH),
    description: lines.join("\n").slice(0, MAX_DESCRIPTION_LENGTH),
  };
}

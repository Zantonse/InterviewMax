import type { ChatMessage } from "@/lib/ai/types";
import { extractJson } from "@/lib/stories/prompts";
import { MAX_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH, isRecord } from "./content";
import type { FetchedPosting } from "./posting-sources";

// A job posting saved as PDF (e.g. "Save as PDF" on LinkedIn or Indeed, where links can't be read).
// The PDF's text carries the site's menus and "similar jobs" around the posting, so one model call
// ("postingExtract") picks out the posting. Every line it returns must appear in the PDF; the rest
// are dropped, so nothing is reworded or invented.

export const POSTING_EXTRACT_SYSTEM = `You are given the text of a job posting saved as a PDF from a job site such as LinkedIn or Indeed. Besides the posting, the text usually contains the site's menus, buttons, ads, applicant counts and lists of other jobs.

Return the job title, the hiring company, and the posting itself: the description, responsibilities, requirements, qualifications, benefits, salary and location, in their original order.

The hard rule: copy the posting's lines exactly as they appear in the text, one line per line. Don't reword, summarise, fix or add anything. Leave out everything that isn't part of this one posting (site menus, "Apply" and "Save" buttons, applicant counts, "people also viewed", other jobs, cookie and sign-in notices).

If there's no job posting in the text, return empty strings.

Reply with JSON only, no other text:
{"title": "…", "company": "…", "lines": ["…"]}`;

export function postingExtractMessages(pdfText: string): ChatMessage[] {
  return [{ role: "user", content: `Here is the text of the PDF.\n\n${pdfText}` }];
}

// Compares lines ignoring spacing and case, so a line still matches when the PDF broke it oddly.
function key(line: string): string {
  return line.toLowerCase().replace(/[\s ]+/g, " ").trim();
}

export function parsePostingExtract(text: string, pdfText: string): FetchedPosting | null {
  const json = extractJson(text);
  if (!isRecord(json)) return null;
  const source = key(pdfText);
  const inPdf = (line: string) => line !== "" && source.includes(key(line));
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const lines = (Array.isArray(json.lines) ? json.lines : [])
    .map(str)
    .filter(inPdf);
  const title = str(json.title);
  const company = str(json.company);
  if (lines.length === 0) return null;
  return {
    title: inPdf(title) ? title.slice(0, MAX_TITLE_LENGTH) : "",
    company: inPdf(company) ? company.slice(0, MAX_TITLE_LENGTH) : "",
    description: lines.join("\n").slice(0, MAX_DESCRIPTION_LENGTH),
  };
}

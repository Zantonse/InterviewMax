import { MAX_TITLE_LENGTH, MIN_TRANSCRIPT_LENGTH } from "./content";

// One uploaded file often holds more than one interview ("Interview 1", "Interview 2") and
// sometimes things that aren't the conversation: the job description, or another tool's feedback
// pasted after it (tester files, Oct 17). Each interview is reviewed on its own, and the rest is
// left out, so the review never quotes a job posting or someone else's "polished answer" as the
// user's words. Cut in code at headings on their own line; the text itself is never changed.

export type InterviewPart = {
  // The heading it was under ("Interview 2", "Recruiter"), or "Interview N" when it had none.
  label: string;
  text: string;
};

export type LeftOut = "job" | "notes";

export type SplitResult = { interviews: InterviewPart[]; leftOut: LeftOut[] };

// A heading is a short line on its own. Conversation lines are rarely this short and never match.
const MAX_HEADING_LENGTH = 50;

const INTERVIEW_HEADINGS = [
  /^(?:interview|round|call|conversation)\s*#?\s*\d+\b.*$/i,
  /^(?:first|second|third|fourth|fifth|final|1st|2nd|3rd|4th|5th)\s+(?:round|interview|call)\b.*$/i,
  /^(?:recruiter|phone|hiring manager|panel|technical|peer|onsite|on-site|final)(?:\s+(?:screen|interview|round|call))?$/i,
];
const JOB_HEADINGS = /^(?:the\s+)?(?:job|job description|job posting|posting|role|role description|the role)$/i;
const NOTES_HEADINGS =
  /^(?:tl;?dr\b.*|summary|interview summary|feedback|analysis|my notes|notes|strengths\b.*|weaknesses\b.*|scoring\b.*|coaching\b.*|chatgpt\b.*|ai feedback|ai review)$/i;

type Kind = "interview" | LeftOut;

function headingKind(line: string): Kind | null {
  const t = line.trim().replace(/[:.\-–—]+$/, "").trim();
  if (!t || t.length > MAX_HEADING_LENGTH) return null;
  if (INTERVIEW_HEADINGS.some((re) => re.test(t))) return "interview";
  if (JOB_HEADINGS.test(t)) return "job";
  if (NOTES_HEADINGS.test(t)) return "notes";
  return null;
}

// Word files often lose the break around a heading: "…Bye.Interview 2" ends a paragraph, or
// "Interview 1 . Hey, good afternoon…" starts one. Only a numbered interview heading is split
// out this way, and only with a full stop after it at the start (notes say "Interview 2: they
// pushed on…"); anything else glued to text stays text.
const GLUED_END = /^(.*[.!?"”'’)])\s*((?:interview|round|call)\s*#?\s*\d+)\s*$/i;
const GLUED_START = /^\s*((?:interview|round|call)\s*#?\s*\d+)\s+\.\s+(\S.*)$/i;

// A pasted job posting whose "Job" heading lost its break: it starts with the word and reads like
// a posting (responsibilities, requirements and the like).
const GLUED_JOB = /^\s*(?:job(?: description| posting)?|posting)\b[:\s]/i;
const POSTING_WORDS = [
  /responsibilities/i,
  /requirements/i,
  /qualifications/i,
  /bachelor/i,
  /years of experience/i,
  /equal (?:employment )?opportunity/i,
];

function looksLikePosting(line: string): boolean {
  return GLUED_JOB.test(line) && POSTING_WORDS.filter((re) => re.test(line)).length >= 2;
}

function headingLines(text: string): string[] {
  return text.split("\n").flatMap((line) => {
    if (looksLikePosting(line)) return ["Job", line];
    const end = GLUED_END.exec(line);
    const [body, tail] = end ? [end[1], [end[2]]] : [line, []];
    const start = GLUED_START.exec(body);
    return [...(start ? [start[1], start[2]] : [body]), ...tail];
  });
}

export function splitInterviews(text: string): SplitResult {
  const sections: { kind: Kind; heading: string; lines: string[] }[] = [
    { kind: "interview", heading: "", lines: [] },
  ];
  for (const line of headingLines(text)) {
    const kind = headingKind(line);
    if (kind) {
      sections.push({ kind, heading: kind === "interview" ? cleanHeading(line) : "", lines: [] });
    } else {
      sections[sections.length - 1].lines.push(line);
    }
  }

  const interviews: InterviewPart[] = [];
  const leftOut = new Set<LeftOut>();
  for (const s of sections) {
    const body = s.lines.join("\n").trim();
    if (s.kind !== "interview") {
      if (body) leftOut.add(s.kind);
      continue;
    }
    // Too short to be an interview: a stray line before the first heading, say.
    if (body.length < MIN_TRANSCRIPT_LENGTH) continue;
    interviews.push({ label: s.heading, text: body });
  }
  // Unheaded interviews are named by their place in the file, so the first of
  // "…, Interview 2" reads "Interview 1".
  interviews.forEach((p, i) => {
    if (!p.label) p.label = `Interview ${i + 1}`;
  });
  return { interviews, leftOut: [...leftOut] };
}

function cleanHeading(line: string): string {
  return line.trim().replace(/[:.\-–—]+$/, "").trim();
}

// The saved title of one interview from the file. A lone interview keeps the file's title unless
// its heading says something ("Recruiter"); "Interview 1" on its own adds nothing.
export function partTitle(title: string, part: InterviewPart, count: number): string {
  const generic = /^interview \d+$/i.test(part.label);
  if (count === 1 && generic) return title;
  return `${title} · ${part.label}`.slice(0, MAX_TITLE_LENGTH);
}

const LEFT_OUT_LABELS: Record<LeftOut, string> = { job: "a job description", notes: "feedback notes" };

// "I left out a job description and feedback notes", or "" when nothing was.
export function leftOutNote(leftOut: readonly string[]): string {
  const parts = (["job", "notes"] as const).filter((k) => leftOut.includes(k)).map((k) => LEFT_OUT_LABELS[k]);
  if (parts.length === 0) return "";
  return `The file also had ${parts.join(" and ")}. I left ${parts.length === 1 ? "it" : "them"} out, so the review only reads the conversation.`;
}

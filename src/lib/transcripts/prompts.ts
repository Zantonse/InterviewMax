import type { ChatMessage } from "@/lib/ai/types";
import { isRecord } from "@/lib/jobs/content";
import { QUESTION_THEMES, getTheme } from "@/lib/questions/themes";
import { untracedNumbers } from "@/lib/stories/numbers";
import { extractJson } from "@/lib/stories/prompts";
import {
  ANSWER_GAPS,
  LANDED,
  MAX_ASKED,
  MAX_LOOKING_FOR,
  MAX_PROBES,
  gapList,
  quoteAppears,
  trimQuote,
  type AskedQuestion,
  type LookingFor,
  type TranscriptAnalysis,
} from "./content";

// The model call in past interviews ("transcriptRead"): read one real interview transcript and
// pull out what the interviewer asked and probed for, and how each of the user's answers landed.
// Every finding carries a quote; parseTranscriptReply keeps only quotes found in the transcript.

export const TRANSCRIPT_READ_SYSTEM = `You are an interview coach reviewing the transcript of a real job interview the candidate already had, so they can prepare better for the next one. Work only from the transcript.

Find:
1. Every question the interviewer asked the candidate, in order (up to ${MAX_ASKED}; skip small talk and logistics). For each:
   - question: the interviewer's words, copied exactly from the transcript. Keep it short; if the question is long, copy the key sentence.
   - theme: one of ${QUESTION_THEMES.map((t) => t.id).join(", ")}, or "other" for technical, case or role-knowledge questions.
   - probes: up to ${MAX_PROBES} follow-up questions the interviewer asked about that answer, each copied exactly. These show what the interviewer wanted more of.
   - landed: "strong", "mixed" or "weak" for how the candidate's answer came across to the interviewer, judged from what they said and how the interviewer reacted (probing for something missing, moving on quickly, or saying it was helpful).
   - evidence: a short span of the candidate's answer, copied exactly, that shows why it landed that way.
   - note: one sentence on why, naming what worked or what was missing. Don't state any number that isn't in the transcript.
   - gaps: what the answer was missing, from: ${ANSWER_GAPS.map((g) => `${g.id} (${g.label.toLowerCase()})`).join(", ")}. Empty for a strong answer.
2. lookingFor: up to ${MAX_LOOKING_FOR} things this interviewer clearly cared about (e.g. "measurable results", "handling pushback from execs"), each with quote: the interviewer's words, copied exactly, that show it.
3. summary: one sentence on what this interview focused on.

Rules:
- Quotes must be copied word for word from the transcript, without the speaker's name. Use "…" to skip words inside a quote. A finding whose quote isn't in the transcript is discarded.
- Speaker labels may be names, "Interviewer"/"Candidate", "Speaker 1"/"Speaker 2", or missing. Work out who is interviewing from who asks the questions. If the candidate told you which speaker they are, trust that.
- Be honest: a coach who calls every answer strong is no help. Be specific: name the missing piece, not "could be stronger".
- Never invent facts, names or numbers.

Reply with JSON only, no other text:
{"summary": "…", "lookingFor": [{"point": "…", "quote": "…"}], "asked": [{"question": "…", "theme": "…", "probes": ["…"], "landed": "strong|mixed|weak", "evidence": "…", "note": "…", "gaps": ["…"]}]}`;

export function transcriptReadMessages(input: {
  transcript: string;
  title: string;
  company: string | null;
  speaker: string;
  job?: { title: string; company: string | null } | null;
}): ChatMessage[] {
  const { transcript, title, company, speaker, job } = input;
  const lines = [
    `Interview: ${title}${company ? ` at ${company}` : ""}`,
    job ? `It was for this job: ${job.title}${job.company ? ` at ${job.company}` : ""}` : "",
    speaker
      ? `I'm the speaker labelled "${speaker}" in the transcript.`
      : "I haven't said which speaker I am.",
  ].filter(Boolean);
  return [
    {
      role: "user",
      content: `Review this interview I had.\n\n${lines.join("\n")}\n\n## Transcript\n${transcript.trim()}`,
    },
  ];
}

// Parses the model's reply and keeps only what traces to the transcript:
// - a question whose quote isn't in the transcript is dropped, with its probes;
// - a probe or "looking for" quote that isn't there is dropped;
// - a judgment whose evidence isn't there becomes "unclear", with no note or gaps;
// - a note or point with a number that isn't in the transcript is dropped.
export function parseTranscriptReply(
  text: string,
  transcript: string,
): Omit<TranscriptAnalysis, "model" | "analyzedAt"> {
  const json = extractJson(text);
  if (!isRecord(json) || !Array.isArray(json.asked)) {
    throw new Error("The review came back in an unexpected format.");
  }
  let dropped = 0;
  const traced = (raw: unknown): string => {
    const quote = typeof raw === "string" ? trimQuote(raw) : "";
    if (!quote) return "";
    if (quoteAppears(quote, transcript)) return quote;
    dropped += 1;
    return "";
  };
  const numbersTrace = (line: string) => untracedNumbers(line, transcript).length === 0;

  const seen = new Set<string>();
  const asked: AskedQuestion[] = [];
  for (const raw of json.asked) {
    if (!isRecord(raw)) continue;
    const question = traced(raw.question);
    if (!question || seen.has(question.toLowerCase())) continue;
    seen.add(question.toLowerCase());
    const evidence = traced(raw.evidence);
    const landed = evidence ? (LANDED.find((l) => l === raw.landed && l !== "unclear") ?? "unclear") : "unclear";
    const note = typeof raw.note === "string" ? raw.note.trim().slice(0, 300) : "";
    asked.push({
      question,
      theme: getTheme(typeof raw.theme === "string" ? raw.theme.trim() : "")?.id ?? null,
      probes: (Array.isArray(raw.probes) ? raw.probes : [])
        .map(traced)
        .filter(Boolean)
        .slice(0, MAX_PROBES),
      landed,
      note: landed !== "unclear" && numbersTrace(note) ? note : "",
      evidence: landed !== "unclear" ? evidence : "",
      gaps: landed === "unclear" || landed === "strong" ? [] : gapList(raw.gaps),
    });
    if (asked.length >= MAX_ASKED) break;
  }
  if (asked.length === 0) {
    throw new Error(
      "I couldn't find the interviewer's questions in that transcript. Check it has both sides of the conversation.",
    );
  }

  const lookingFor: LookingFor[] = [];
  for (const raw of Array.isArray(json.lookingFor) ? json.lookingFor : []) {
    if (!isRecord(raw) || typeof raw.point !== "string") continue;
    const point = raw.point.trim().slice(0, 200);
    const quote = traced(raw.quote);
    if (!point || !quote || !numbersTrace(point)) continue;
    lookingFor.push({ point, quote });
    if (lookingFor.length >= MAX_LOOKING_FOR) break;
  }

  const summary = typeof json.summary === "string" ? json.summary.trim().slice(0, 300) : "";
  return {
    summary: numbersTrace(summary) ? summary : "",
    lookingFor,
    asked,
    dropped,
  };
}

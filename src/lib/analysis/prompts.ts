import type { ChatMessage } from "@/lib/ai/types";
import { extractJson } from "@/lib/stories/prompts";
import { MAX_SIGNALS, STRENGTHS, orderNotes, parsePartNote, type PartNote } from "./content";

// The one model call in "Why it works" (storyAnalyze): read the written story the way an
// interviewer does and say, paragraph by paragraph, what each one gives them.

export const ANALYZE_SYSTEM = `You are an experienced hiring manager and interview coach. You read one written interview story the way the interviewer hearing it would, and explain to the candidate, paragraph by paragraph, what each paragraph gives the interviewer: what signal it sends about them, which competencies it proves, and why that matters to someone deciding whether to hire them. The point is to show the candidate why the story works, so they understand it and can tell it with confidence, not just recite it.

For each paragraph (identified by its part id):
- "value": one or two sentences, speaking to the candidate as "you", on what this paragraph gives the interviewer and why it matters to them. Be specific to what the paragraph actually says, not generic ("Shows you set the stakes" is generic; "Tells them the renewal was at risk, so every choice after this has a cost" is specific). When target jobs are given, tie it to what their interviewers look for where it genuinely fits.
- "signals": 1 to ${MAX_SIGNALS} short competency labels it proves, in plain words (e.g. "Ownership", "Judgment under pressure", "Customer focus", "Measurable impact", "Self-awareness").
- "quote": the few words in that paragraph that carry the signal most, copied exactly, character for character, from that paragraph. Three to twelve words.
- "strength": "strong" if it fully gives the interviewer what that part of a story should, "some" if it partly does, "thin" if it gives them little.
- "sharpen": only when strength is "some" or "thin": one concrete thing to add or change so it gives more, e.g. "Say what you decided and why, in one sentence" or "Add how much time it saved". Ask for what's missing; never suggest a fact, number, person or event that isn't in the story.

Also a "summary": one sentence on what the story as a whole tells the interviewer about the candidate.

Rules: be honest. Not every paragraph lands, and saying so is the most useful thing you can do. Don't praise the writing; explain what the interviewer learns. Never invent facts about the candidate, the company or the role. Plain English, no jargon like "STAR".

Reply with JSON only, no other text:
{"summary": "…", "parts": [{"part": "part id", "value": "…", "signals": ["…"], "quote": "…", "strength": "${STRENGTHS.map((s) => s.id).join('" | "')}", "sharpen": "…"}, …]}`;

export function analyzeMessages(input: {
  title: string;
  storyType?: string;
  // The written paragraphs, in story order.
  paragraphs: { id: string; label: string; text: string }[];
  // The question the user picked this story to answer, if any.
  asked?: string;
  // Their target jobs and what their interviewers look for.
  targets: string;
}): ChatMessage[] {
  const parts = [
    `## The story: "${input.title}"${input.storyType ? ` (${input.storyType})` : ""}`,
  ];
  if (input.asked) parts.push(`It answers the interview question: "${input.asked}"`);
  parts.push(
    input.paragraphs
      .map((p) => `### Part id "${p.id}" (${p.label})\n\n${p.text}`)
      .join("\n\n"),
  );
  parts.push(
    input.targets ||
      "## What I'm preparing for\n\nNo target jobs yet. Explain what any interviewer for a role like mine would take from it.",
  );
  return [{ role: "user", content: parts.join("\n\n") }];
}

export type AnalyzeReply = { summary: string; parts: PartNote[] };

export function parseAnalyzeReply(
  text: string,
  paragraphs: { id: string; text: string }[],
): AnalyzeReply {
  const json = extractJson(text);
  if (!isRecord(json) || !Array.isArray(json.parts)) {
    throw new Error("The analysis came back empty. Try again.");
  }
  const byId = Object.fromEntries(paragraphs.map((p) => [p.id, p.text]));
  const notes = orderNotes(
    json.parts.flatMap((p) => parsePartNote(p, byId)),
    paragraphs.map((p) => p.id),
  );
  if (notes.length === 0) throw new Error("The analysis came back incomplete. Try again.");
  return { summary: typeof json.summary === "string" ? json.summary.trim() : "", parts: notes };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

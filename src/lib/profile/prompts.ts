import type { ChatMessage } from "@/lib/ai/types";
import { untracedNumbers } from "@/lib/stories/numbers";
import { extractJson } from "@/lib/stories/prompts";
import { READINESS_LABELS, STATUS_LABELS, type ProfileResult } from "./assess";

// The one model call in the interviewee profile ("profileSummary"): a short overall assessment in
// coach tone, written from the results worked out in code and nothing else. Code checks that every
// figure in it comes from those results; a summary that fails falls back to one written in code.

export const MAX_SUMMARY_WORDS = 90;

export const PROFILE_SUMMARY_SYSTEM = `You are an interview coach giving one candidate a short, honest read of where they stand. You are given their profile, already worked out from their own stories, grades, practice answers and past interviews.

Write 2 to 4 sentences, under ${MAX_SUMMARY_WORDS} words, addressed to them as "you":
- Lead with the clearest strength, then the one thing that would move them forward most, then (if they have target jobs) how close they are for the job they're nearest to.
- Use only what the profile says. Never add a fact, a story, a score or a number it doesn't contain, and never guess at their background.
- Warm and direct, like a coach who is on their side: no hype, no exclamation marks, no jargon such as "STAR", "criterion" or "bank".
- If the profile has little in it yet, say so plainly and name the first step.

Reply with JSON only, no other text:
{"summary": "…"}`;

export function profileSummaryMessages(facts: string): ChatMessage[] {
  return [{ role: "user", content: `## My profile\n${facts}` }];
}

export function parseProfileSummary(text: string): string {
  const json = extractJson(text);
  const summary =
    json && typeof json === "object" && typeof (json as Record<string, unknown>).summary === "string"
      ? ((json as Record<string, unknown>).summary as string).trim()
      : "";
  return summary;
}

// A summary is kept only when it isn't empty, isn't far too long and every figure in it is in the
// facts it was written from.
export function checkSummary(summary: string, facts: string): boolean {
  if (!summary) return false;
  const words = summary.split(/\s+/).filter(Boolean).length;
  if (words > MAX_SUMMARY_WORDS * 1.5) return false;
  return untracedNumbers(summary, facts).length === 0;
}

// The summary written in code: shown until the model's one is ready, and whenever it fails.
export function fallbackSummary(result: ProfileResult): string {
  if (result.empty) {
    return "There isn't much to go on yet. Write your first story and your profile will start filling in.";
  }
  const parts: string[] = [];
  const strength = result.strengths[0];
  if (strength) parts.push(`Your clearest strength: ${strength.text}`);
  const weakness = result.weaknesses[0];
  if (weakness) parts.push(`The biggest step forward: ${weakness.text}`);
  const nearest = [...result.jobs].sort((a, b) => rank(b.label) - rank(a.label))[0];
  if (nearest) parts.push(`For ${nearest.title} you're ${READINESS_LABELS[nearest.label].toLowerCase()}.`);
  if (parts.length === 0) {
    const known = result.criteria.filter((c) => c.status !== "no_data");
    parts.push(
      known.length
        ? `${known.map((c) => `${c.label}: ${STATUS_LABELS[c.status].toLowerCase()}`).join("; ")}.`
        : "Keep going: your profile fills in as you write and grade stories.",
    );
  }
  return parts.join(" ");
}

function rank(label: string): number {
  return label === "ready" ? 2 : label === "getting_there" ? 1 : 0;
}

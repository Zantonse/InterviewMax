import type { ChatMessage } from "@/lib/ai/types";
import { getTheme } from "@/lib/questions/themes";
import { extractJson } from "@/lib/stories/prompts";
import { FITS, MAX_PICKS, orderPicks, type AlsoAnswer, type Candidate, type FitId } from "./content";

// The one model call in "Also answers" (storyQuestions): pick, from a numbered list, the other
// interview questions this written story can answer, and say what to lead with for each.

export const QUESTIONS_SYSTEM = `You are an experienced interview coach. A candidate has written one interview story. Most candidates think a story answers only the question they wrote it for, so they over-prepare and freeze when a question is worded differently. Your job is to show them which other questions on a numbered list this same story can answer well, and how to angle it for each.

Pick at most ${MAX_PICKS} questions from the list. Only pick a question when the story, as written, has what that question is really asking for: an interviewer who asked it would hear a real answer, not a stretch. It's fine to pick fewer, or none. Prefer questions from the candidate's target jobs and past interviews when they fit equally well. Don't pick two questions that ask the same thing in different words; pick the one most likely to be asked.

For each pick:
- "n": the question's number on the list.
- "fit": "strong" if the story answers it as told, in the same order; "angle" if it answers it once the candidate leads with a different part of the story (say the conflict first, or the lesson first).
- "emphasize": one sentence, speaking to the candidate as "you", on what to lead with and stress for this question, naming the specific moment, decision or result from the story (e.g. "Open with the night you told the VP the launch date was wrong, then spend most of the time on how you rebuilt the plan."). At most 35 words. Use only what's in the story; never add a fact, number, person or event.

Plain English, no jargon like "STAR". Reply with JSON only, no other text:
{"picks": [{"n": 3, "fit": "${FITS.map((f) => f.id).join('" | "')}", "emphasize": "…"}, …]}`;

export function questionsMessages(input: {
  title: string;
  storyType?: string;
  // The written story, as one script.
  story: string;
  // The question it was built for, if any.
  asked?: string;
  candidates: Candidate[];
}): ChatMessage[] {
  const parts = [`## The story: "${input.title}"${input.storyType ? ` (${input.storyType})` : ""}`];
  if (input.asked) parts.push(`It was written to answer: "${input.asked}"`);
  parts.push(input.story);
  parts.push(
    "## The questions to check it against",
    input.candidates
      .map((c, i) => {
        const theme = c.theme ? getTheme(c.theme)?.label : undefined;
        const own = c.sources.some((s) => s.kind === "job" || s.kind === "interview")
          ? " [target job or past interview]"
          : "";
        return `${i + 1}. ${c.question}${theme ? ` (${theme})` : ""}${own}`;
      })
      .join("\n"),
  );
  return [{ role: "user", content: parts.join("\n\n") }];
}

const FIT_IDS = new Set<string>(FITS.map((f) => f.id));

// Maps the model's numbers back to the candidates, so every question shown is one the app already
// had, worded as it was. Unknown numbers, repeats and picks without an emphasis line are dropped.
export function parseQuestionsReply(text: string, candidates: Candidate[]): AlsoAnswer[] {
  const json = extractJson(text);
  if (!isRecord(json) || !Array.isArray(json.picks)) {
    throw new Error("The check came back empty. Try again.");
  }
  const seen = new Set<number>();
  const picks: AlsoAnswer[] = [];
  for (const p of json.picks) {
    if (!isRecord(p)) continue;
    const n = typeof p.n === "number" ? p.n : typeof p.n === "string" ? Number(p.n) : NaN;
    const candidate = Number.isInteger(n) ? candidates[n - 1] : undefined;
    const emphasize = typeof p.emphasize === "string" ? p.emphasize.trim() : "";
    if (!candidate || !emphasize || seen.has(n)) continue;
    seen.add(n);
    const fit: FitId = typeof p.fit === "string" && FIT_IDS.has(p.fit) ? (p.fit as FitId) : "angle";
    picks.push({ ...candidate, fit, emphasize: emphasize.slice(0, 300) });
    if (picks.length === MAX_PICKS) break;
  }
  return orderPicks(picks);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

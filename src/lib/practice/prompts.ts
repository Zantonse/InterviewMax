import type { ChatMessage } from "@/lib/ai/types";
import { extractJson } from "@/lib/stories/prompts";
import {
  type Closeness,
  MAX_FOLLOW_UPS,
  type NewFact,
  type PracticeTurn,
  formatDuration,
  hasFigure,
  timingNote,
  type Timing,
} from "./content";

// The two model calls in practice mode (PRD v0.3):
//   practiceProbe:    a skeptical interviewer decides on one follow-up, aimed at the weakest part
//   practiceFeedback: feedback on the whole exchange against the saved story
// Neither changes a story or a grade. New facts only reach a story when the user confirms them.

// What a practice question is about. Nothing here is tied to a target job, so other rehearsal
// flows (the tough-questions coach) can pass their own question and saved answer.
export type PracticeContext = {
  question: string;
  // The job being practiced for, when there is one.
  role?: { title: string; company: string | null; level: string | null };
  // The saved answer to compare with: its title, the script, and the user's own answers behind it
  // (so feedback knows what's already in the story).
  reference?: { title: string; script: string; answers: string };
  turns: PracticeTurn[];
};

const GAPS = ["situation", "role", "ownership", "actions", "decision", "result", "reflection"];

// The interviewer only hears what was said, never the saved story: that's what a real one gets.
export const PRACTICE_PROBE_SYSTEM = `You are a skeptical but fair interviewer in a behavioral interview. The candidate just answered your question out loud (the text is a speech-to-text transcript, so ignore small transcription slips and filler words). Decide on one follow-up question, the way a real interviewer probes.

Aim it at the weakest part of what they said so far:
- a vague role: "we" everywhere, so you can't tell what they did themselves
- no number: a result with no figure, or a figure with no context (against what target, out of how many, before and after)
- no result: the story stops at what they did, with no outcome
- no decision: steps, but no choice between options and why they picked one
- a claim with no example behind it

Rules:
- One question, one or two short sentences, spoken style. Refer to something specific they said, so it's clear you listened.
- Never ask something they already answered, including in earlier follow-ups.
- Never suggest an answer, a number or a detail.
- You ask at most ${MAX_FOLLOW_UPS} follow-ups per question. The first follow-up is always asked. After that, ask another only if a clear weak spot is left; otherwise you're done.

Reply with JSON only, no other text:
{"followUp": {"question": "…", "gap": "one of ${GAPS.join(", ")}"}}
or, when you're done:
{"followUp": null}`;

export function probeMessages(ctx: PracticeContext, hints: string[]): ChatMessage[] {
  const lines = [roleLine(ctx), "", exchangeTranscript(ctx.turns)];
  if (hints.length) lines.push("", "Notes from a quick check of their answers:", ...hints);
  const asked = Math.max(0, ctx.turns.length - 1);
  lines.push(
    "",
    asked === 0
      ? "This is your first follow-up: ask one."
      : `You've asked ${asked} follow-up${asked === 1 ? "" : "s"}. Ask one more only if a clear weak spot is left.`,
  );
  return [{ role: "user", content: lines.join("\n").trim() }];
}

// Plain-code notes for the interviewer: no figure anywhere, or more "we" than "I".
export function probeHints(spoken: string): string[] {
  const hints: string[] = [];
  if (!hasFigure(spoken)) hints.push("- They haven't said a single number.");
  const i = spoken.match(/\b(I|me|my|myself)\b/gi)?.length ?? 0;
  const we = spoken.match(/\bwe\b/gi)?.length ?? 0;
  if (we > i) hints.push(`- They said "we" ${we} times and "I" ${i} times.`);
  return hints;
}

export type ProbeResult = { question: string; gap: string } | null;

export function parseProbe(text: string): ProbeResult {
  const raw = extractJson(text);
  if (!isRecord(raw) || !isRecord(raw.followUp)) return null;
  const question = typeof raw.followUp.question === "string" ? raw.followUp.question.trim() : "";
  if (!question) return null;
  const gap = typeof raw.followUp.gap === "string" ? raw.followUp.gap.trim() : "";
  return { question: question.slice(0, 400), gap: GAPS.includes(gap) ? gap : "" };
}

export const PRACTICE_FEEDBACK_SYSTEM = `You are an interview coach giving feedback on one practice answer. The candidate answered a behavioral interview question out loud, then answered the interviewer's follow-ups. The text is a speech-to-text transcript: ignore small transcription slips, and don't comment on filler words or pace (that's a separate feature).

When they have a saved story for this question, compare what they said with it:
- closeness: "close" if they told the saved story with its key points, "partly" if they told it but dropped key points, "drifted" if they told a different story or lost the thread.
- missing: the key points of the saved story they left out (the stakes, what they did themselves, the decision, the result), most important first.
When there's no saved story, closeness is "no_story", and missing is what a strong answer to this question would need that theirs didn't have.

Also give:
- summary: one sentence on how the answer landed, as the interviewer would remember it.
- landed: one or two things that worked, specific to what they said.
- missing: up to three things, each one short sentence saying what to add next time.
- followUpsNote: one sentence on how they handled the follow-ups (did they answer the question asked, with a specific).
- newFacts: only when there's a saved story. Up to three things they said that are true details NOT in the saved story or the answers behind it, worth adding to the story: a number, a concrete example, a decision and why. For each, "fact" is one short first-person sentence of that detail, and "quote" is the exact words they said, copied from the transcript (at least five words). Never include anything they didn't say, and never change a number. If there's nothing new, return [].

The rules: never invent facts or numbers, and never give a score or a grade. Be direct and kind, like a coach between rounds.

Reply with JSON only, no other text:
{"summary": "…", "closeness": "close | partly | drifted | no_story", "closenessNote": "one sentence", "landed": ["…"], "missing": ["…"], "followUpsNote": "…", "newFacts": [{"fact": "…", "quote": "…"}]}`;

export function feedbackMessages(
  ctx: PracticeContext,
  facts: { timing: Timing; numbersLeftOut: string[] },
): ChatMessage[] {
  const lines = [roleLine(ctx), ""];
  if (ctx.reference) {
    lines.push(
      `## Their saved story: "${ctx.reference.title}"`,
      ctx.reference.script.trim(),
      "",
      "## Their answers behind the saved story",
      ctx.reference.answers.trim() || "(none)",
      "",
    );
  } else {
    lines.push("They have no saved story for this question yet.", "");
  }
  lines.push(
    "## The practice",
    exchangeTranscript(ctx.turns),
    "",
    "## Checked in code (don't repeat as your own finding)",
    `- Their first answer took ${timingNote(facts.timing)}`,
  );
  if (facts.numbersLeftOut.length) {
    lines.push(`- Figures in the saved story they never said: ${facts.numbersLeftOut.join(", ")}`);
  }
  return [{ role: "user", content: lines.join("\n").trim() }];
}

export type ParsedFeedback = {
  summary: string;
  closeness: Closeness;
  closenessNote: string;
  landed: string[];
  missing: string[];
  followUpsNote: string;
  newFacts: NewFact[];
};

const CLOSENESS: readonly Closeness[] = ["close", "partly", "drifted", "no_story"];

export function parseFeedback(text: string, hasReference: boolean): ParsedFeedback {
  const raw = extractJson(text);
  if (!isRecord(raw) || typeof raw.summary !== "string" || !raw.summary.trim()) {
    throw new Error("The feedback came back incomplete. Try again.");
  }
  const closeness = CLOSENESS.find((c) => c === raw.closeness);
  return {
    summary: raw.summary.trim().slice(0, 400),
    closeness: hasReference ? (closeness && closeness !== "no_story" ? closeness : "partly") : "no_story",
    closenessNote: typeof raw.closenessNote === "string" ? raw.closenessNote.trim().slice(0, 400) : "",
    landed: shortList(raw.landed, 2),
    missing: shortList(raw.missing, 3),
    followUpsNote:
      typeof raw.followUpsNote === "string" ? raw.followUpsNote.trim().slice(0, 400) : "",
    newFacts:
      hasReference && Array.isArray(raw.newFacts)
        ? raw.newFacts.filter(isRecord).flatMap((f) =>
            typeof f.fact === "string" && typeof f.quote === "string" && f.fact.trim()
              ? [{ fact: f.fact.trim().slice(0, 400), quote: f.quote.trim().slice(0, 600) }]
              : [],
          )
        : [],
  };
}

function roleLine(ctx: PracticeContext): string {
  if (!ctx.role) return "";
  const level = ctx.role.level ? ` (${ctx.role.level} level)` : "";
  return `The interview is for: ${ctx.role.title}${ctx.role.company ? ` at ${ctx.role.company}` : ""}${level}.`;
}

// The exchange so far, as a transcript. Each answer says how long it took when it was recorded.
export function exchangeTranscript(turns: PracticeTurn[]): string {
  return turns
    .flatMap((t, i) => {
      const who = i === 0 ? "Interviewer" : "Interviewer (follow-up)";
      const lines = [`${who}: ${t.question}`];
      if (t.answer?.trim()) {
        const took = t.seconds ? ` [spoke for ${formatDuration(t.seconds)}]` : "";
        lines.push(`Candidate${took}: ${t.answer.trim()}`);
      }
      return lines;
    })
    .join("\n");
}

function shortList(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim().slice(0, 300))
    .slice(0, max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

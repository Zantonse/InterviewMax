import type { ChatMessage } from "@/lib/ai/types";
import { extractJson } from "@/lib/stories/prompts";
import { MAX_HEADLINE_WORDS, MAX_SAVE_FOR, RECRUITER_WORDS, parseSaveFor } from "./content";

// The one model call in "Recruiter version" (storyRecruiter): cut a written story to what a
// recruiter screen needs. Every figure is checked against the user's answers afterwards, along
// with length, jargon and own words (make.ts).

export const RECRUITER_SYSTEM = `You are an interview coach. A candidate has written one of their behavioral interview stories. Rewrite it as the version they'd tell in a recruiter screen. A recruiter is checking fit and whether to pass them on to the hiring manager. They are usually not an expert in the candidate's work, they have a checklist of what the role needs, and they have a few minutes per question.

The hard rule: use only facts and figures in what you're given. Never add, round, inflate, convert or combine numbers; copy every figure exactly as written. Never invent a result, a reason, a person or an event. Keep the candidate's own phrasing wherever you can: cut and reorder their sentences rather than rephrase them. No corporate filler ("spearheaded", "leveraged", "drove alignment").

Plain words: a recruiter may not know the field's acronyms, tool names or team shorthand. Say what a thing is ("the nightly job that loads our sales data") rather than its acronym ("the ETL"), unless the acronym is something everyone knows (AI, CEO, VP, HR).

Three lines, said in this order, ${RECRUITER_WORDS.min} to ${RECRUITER_WORDS.max} words together (under a minute out loud):
1. "headline": the result, with its number when the story has one, in one sentence of at most ${MAX_HEADLINE_WORDS} words. Start with the result, e.g. "I cut onboarding from six weeks to two." No "So," or "Great question".
2. "context": one sentence on the situation in plain words: what was wrong or at stake.
3. "part": one or two sentences on what the candidate did themselves, plainly.

Then "saveFor": ${MAX_SAVE_FOR} or fewer short phrases naming the details from the story to save for the hiring manager (the method, the hard tradeoff, the tools, who they had to win over), so the candidate can offer "happy to go deeper on that". Only details the story contains.

First person, short sentences someone can say in one breath. No headings or bold.

Reply with JSON only, no other text:
{"headline": "…", "context": "…", "part": "…", "saveFor": ["…", "…"]}`;

export type RecruiterRetry = { previous: string; problems: string[] };

export function recruiterMessages(input: {
  title: string;
  storyType?: string;
  story: string;
  answers: string;
  asked?: string;
  retry?: RecruiterRetry;
}): ChatMessage[] {
  const parts = [
    `## The story as written: "${input.title}"${input.storyType ? ` (${input.storyType})` : ""}`,
  ];
  if (input.asked) parts.push(`It answers: "${input.asked}"`);
  parts.push(input.story, `## The answers it was written from\n\n${input.answers}`);
  const messages: ChatMessage[] = [{ role: "user", content: parts.join("\n\n") }];
  if (input.retry) {
    messages.push(
      { role: "assistant", content: input.retry.previous },
      {
        role: "user",
        content: `Fix these and reply with the whole JSON again:\n${input.retry.problems.map((p) => `- ${p}`).join("\n")}`,
      },
    );
  }
  return messages;
}

export type RecruiterReply = { headline: string; context: string; part: string; saveFor: string[] };

export function parseRecruiterReply(text: string): RecruiterReply {
  const json = extractJson(text);
  if (!isRecord(json)) throw new Error("The recruiter version came back empty. Try again.");
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const reply = {
    headline: str(json.headline),
    context: str(json.context),
    part: str(json.part),
    saveFor: parseSaveFor(json.saveFor),
  };
  if (!reply.headline) throw new Error("The recruiter version came back empty. Try again.");
  return reply;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

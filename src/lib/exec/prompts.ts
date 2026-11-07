import type { ChatMessage } from "@/lib/ai/types";
import { extractJson } from "@/lib/stories/prompts";
import { EXEC_WORDS, MAX_ASKS, MAX_BOTTOM_LINE_WORDS, parseExecAsks, type ExecAsk } from "./content";

// The one model call in "Exec version" (storyExec): cut a written story to the 30-second version an
// executive wants, answer first, and list what they'd likely ask next. Every figure is checked
// against the user's answers afterwards, along with length, hedging and own words (make.ts).

export const EXEC_SYSTEM = `You are an executive communication coach. A candidate has written one of their behavioral interview stories. Rewrite it as the version they'd give a VP or C-level interviewer: answer first, then only as much as the listener needs. Executives decide in the first sentence whether to keep listening, so the result goes first, not at the end.

The hard rule: use only facts and figures in what you're given. Never add, round, inflate, convert or combine numbers; copy every figure exactly as written. Never invent a result, a reason, a person or an event. Keep the candidate's own phrasing wherever you can: cut and reorder their sentences rather than rephrase them. Executives trust plain words, so no corporate filler ("spearheaded", "leveraged", "drove alignment").

Three lines, said in this order, ${EXEC_WORDS.min} to ${EXEC_WORDS.max} words together (about 30 seconds out loud):
1. "bottomLine": the outcome, with its number when the story has one, in one sentence of at most ${MAX_BOTTOM_LINE_WORDS} words. Start with the result, not the background, e.g. "I cut onboarding from six weeks to two, which saved 40 hours a month." No "So," or "Great question".
2. "why": one sentence on why it mattered to the business or the customer: what was at stake if it hadn't happened.
3. "how": one or two sentences on the one decision that made it work. If the story says how the candidate thinks about this kind of problem (a principle, a rule of thumb, the way they frame it), open this line with that in their words, then the decision ("My rule is to fix the handoff before adding people, so I…"). Leave the rest of the steps out; they're for follow-ups.

Say it flat: no hedging words ("I think", "kind of", "sort of", "maybe", "basically", "hopefully", "pretty much"). First person, short sentences someone can say in one breath. No headings or bold.

Then "ifAsked": the ${MAX_ASKS} questions an executive would most likely ask next about this story (for example how they knew it worked, what it cost, what they needed from leadership, what they'd do differently, what the risk was). For each, "answer" is what the candidate would say, at most 30 words, only from the story or their answers. If the story doesn't answer it, set "answer" to null; don't make one up.

Reply with JSON only, no other text:
{"bottomLine": "…", "why": "…", "how": "…", "ifAsked": [{"question": "…", "answer": "…" or null}, …]}`;

export type ExecRetry = { previous: string; problems: string[] };

export function execMessages(input: {
  title: string;
  storyType?: string;
  story: string;
  answers: string;
  asked?: string;
  retry?: ExecRetry;
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

export type ExecReply = { bottomLine: string; why: string; how: string; ifAsked: ExecAsk[] };

export function parseExecReply(text: string): ExecReply {
  const json = extractJson(text);
  if (!isRecord(json)) throw new Error("The exec version came back empty. Try again.");
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const reply = {
    bottomLine: str(json.bottomLine),
    why: str(json.why),
    how: str(json.how),
    ifAsked: parseExecAsks(json.ifAsked),
  };
  if (!reply.bottomLine) throw new Error("The exec version came back empty. Try again.");
  return reply;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

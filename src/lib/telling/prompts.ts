import type { ChatMessage } from "@/lib/ai/types";
import type { ThinkingFeedback } from "@/lib/stories/grading";
import { extractJson } from "@/lib/stories/prompts";
import { BEATS, VERSIONS, parseBeats, type Beat, type VersionId } from "./content";

// The one model call in "How to tell it" (storyTell): turn a written story into something the user
// tells out loud. Hooks, beats and versions come from the model; the cues and checks are code
// (content.ts), and every figure is checked against the user's answers afterwards (coach.ts).

const [SHORT, LONG] = VERSIONS;

export const TELL_SYSTEM = `You are a storytelling coach helping an experienced professional tell one of their behavioral interview stories out loud, so it sounds like a story they're telling, not a report they're reading. You get the story as written and the answers it was written from. Change how it's told, never what happened.

The hard rule: use only facts and figures the user gave. Never add, round, inflate, convert or combine numbers; copy every figure exactly as written. Never invent a moment, a quote, a feeling, a person or a reason. If something is missing, leave it out.

What a told story has:
1. Hook: a one-line headline that opens with the result or the stakes, e.g. "I turned a stalled migration into the team's fastest launch." Write two different options, both from their own facts: one leading with the result, one leading with the stakes or the tension. Each under 25 words. No "So," or "Great question".
2. Stakes: one sentence on why it mattered and to whom, so the listener cares.
3. The turn: the moment it could have gone wrong, and the decision they made. This is where "I" belongs. Show their thinking here in a sentence or two, using only reasoning they gave: what they noticed, the options they weighed, why they chose, and what they watched for. Keep it to one or two thinking moments so it reads as judgment, not a monologue. If they gave no reasoning, describe the decision plainly and don't make up why.
4. One vivid detail: a specific moment, quote or number from their answers that makes it memorable. Pick it only from what they said. If there isn't one, don't write a detail beat; instead ask them one short question that would draw one out.
5. Land it: the result with its number, said plainly.
6. Link: one line on why it matters for the role they want, from their target jobs when given. Never claim things about a company that aren't in what you're given.

Two versions of the same story, both told after the hook (don't repeat the hook in them):
- "short": the ${SHORT.label} version for quick screens. ${SHORT.words.min} to ${SHORT.words.max} words. Beats in order: stakes, turn, landing, link.
- "long": the ${LONG.label} version for deep-dive rounds. ${LONG.words.min} to ${LONG.words.max} words. Beats in order: stakes, turn, detail (only if there is one), actions, landing, link. In the actions beat, use a short signpost so it's easy to follow ("Three things I did. First… Then… Finally…") with the number matching what follows.

Both versions: setup (the stakes beat) is at most a quarter of the words. The result is never left in the middle: it ends the story in the landing beat. First person, plain spoken English, short sentences someone can say in one breath. No headings, stage directions, pause marks or bold: the app adds the delivery cues.

Reply with JSON only, no other text:
{"hooks": ["…", "…"], "detail": {"quote": "the detail, copied word for word from their answers"} or {"ask": "one short question"}, "short": [{"beat": "stakes", "text": "…"}, …], "long": [{"beat": "${BEATS[0].id}", "text": "…"}, …]}

Beat ids: ${BEATS.map((b) => b.id).join(", ")}.`;

export type TellRetry = {
  previous: string;
  problems: string[];
};

export function tellMessages(input: {
  title: string;
  story: string;
  answers: string;
  thinking?: ThinkingFeedback;
  // Their target jobs and the role they want next, for the link line.
  targets: string;
  retry?: TellRetry;
}): ChatMessage[] {
  const parts = [
    `## The story as written: "${input.title}"\n\n${input.story}`,
    `## The answers it was written from\n\n${input.answers}`,
  ];
  if (input.thinking && input.thinking.level !== "shown") {
    parts.push(
      `## Grader's note on their thinking at the key decision\n\n${input.thinking.note}${
        input.thinking.improve ? ` ${input.thinking.improve}` : ""
      }\nUse any reasoning they gave in their answers at the turn. Don't invent any.`,
    );
  }
  parts.push(
    input.targets ||
      "## What I'm preparing for\n\nNo target jobs yet. Keep the link line general: the kind of work this shows they can do.",
  );
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

export type TellReply = {
  hooks: string[];
  detail: unknown;
  versions: Record<VersionId, Beat[]>;
};

export function parseTellReply(text: string): TellReply {
  const json = extractJson(text);
  if (!isRecord(json)) throw new Error("The coaching came back empty. Try again.");
  const hooks = Array.isArray(json.hooks)
    ? json.hooks
        .filter((h): h is string => typeof h === "string" && Boolean(h.trim()))
        .map((h) => h.trim())
        .slice(0, 2)
    : [];
  const versions = { short: parseBeats(json.short), long: parseBeats(json.long) };
  if (hooks.length === 0 || versions.short.length === 0 || versions.long.length === 0) {
    throw new Error("The coaching came back incomplete. Try again.");
  }
  return { hooks, detail: json.detail, versions };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

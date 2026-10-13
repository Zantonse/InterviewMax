import type { ChatMessage } from "@/lib/ai/types";
import type { FollowUp, StoryContent } from "./content";
import {
  CORE_QUESTIONS,
  STORY_PARTS,
  coreQuestionText,
  type StoryPartId,
  type StoryType,
} from "./story-types";

// The two model calls in the story builder (PRD, step 4):
//   call one (storyProbe): read the scripted answers, ask 2–3 follow-ups aimed at the gaps
//   call two (storyWrite): write the story from the user's own answers, inventing nothing

const CHECKLIST = `- Situation: where they were, their role, and what was at stake are clear.
- Ownership: their own actions are separated from the team's ("I", not only "we").
- Actions: concrete steps, not generalities.
- Decision: where they chose between options, what the options were and why they chose.
- Result: an outcome in real terms with at least one concrete number, or an estimate labelled as one.
- Reflection: a specific lesson or something they'd do differently.`;

const GAPS = ["situation", "ownership", "actions", "decision", "result", "reflection"] as const;

export const PROBE_SYSTEM = `You are an interview coach helping an experienced professional prepare one behavioral interview story. They have answered a fixed set of questions about one experience. Your job is to find the biggest gaps in their answers and ask follow-up questions that fill them.

Check the answers against this checklist:
${CHECKLIST}

Rules:
- Ask 2 or 3 follow-up questions, aimed at the most important gaps first.
- If the result has no concrete number, one question must ask for one and suggest where they could find it (a dashboard, CRM, a report, a manager, an old email). Never suggest or guess a number yourself.
- Ask one thing per question. Keep each question short and conversational, and refer to their specifics so it's clear you read their answers.
- Don't repeat a question they already answered well.

Reply with JSON only, no other text:
{"followUps": [{"question": "…", "gap": "one of ${GAPS.join(", ")}"}]}`;

export const WRITE_SYSTEM = `You are an interview coach writing a behavioral interview story for an experienced professional, from their own answers.

The hard rule: use only facts and figures the user gave. Never add, round, inflate, convert or combine numbers. Copy every figure exactly as they wrote it, and keep words like "about" or "estimated" that they attached to it. If a detail is missing, leave it out; don't fill it in. Don't name customers, people or companies they didn't name.

Write in the first person, in plain spoken English the user could say aloud, as if answering the interviewer. Use "I" for what they did themselves and "we" only for the team. Aim for about 250 to 300 words in total, about two minutes spoken.

Write these parts:
- situation: 2 to 3 sentences on the context and what was at stake.
- role: 1 to 2 sentences on what they owned and what they had to work with.
- actions: 3 to 5 sentences on the steps they took, including the choice they made and why.
- result: 1 to 2 sentences on the outcome, with their number.
- reflection: 1 to 2 sentences on what they learned or would do differently.

Also give the story a short title (at most 8 words) for their story bank, e.g. "Saving the Acme renewal".

Reply with JSON only, no other text:
{"title": "…", "parts": {${STORY_PARTS.map((p) => `"${p.id}": "…"`).join(", ")}}}`;

// The user's answers as an interview transcript, for both calls.
export function answersTranscript(content: StoryContent, storyType: StoryType | undefined): string {
  const lines: string[] = [];
  if (storyType) lines.push(`Story type: ${storyType.label}`, "");
  for (const q of CORE_QUESTIONS) {
    const answer = content.answers[q.id]?.trim();
    if (!answer) continue;
    lines.push(`Q: ${coreQuestionText(q.id, storyType)}`, `A: ${answer}`, "");
  }
  for (const f of content.followUps ?? []) {
    const answer = f.answer?.trim();
    if (!answer) continue;
    lines.push(`Q (follow-up): ${f.question}`, `A: ${answer}`, "");
  }
  return lines.join("\n").trim();
}

export function probeMessages(content: StoryContent, storyType: StoryType | undefined): ChatMessage[] {
  return [
    {
      role: "user",
      content: `Here are my answers so far.\n\n${answersTranscript(content, storyType)}`,
    },
  ];
}

export function writeMessages(
  content: StoryContent,
  storyType: StoryType | undefined,
  retry?: { previous: string; untraced: string[] },
): ChatMessage[] {
  const messages: ChatMessage[] = [
    {
      role: "user",
      content: `Write my story from these answers.\n\n${answersTranscript(content, storyType)}`,
    },
  ];
  if (retry) {
    messages.push(
      { role: "assistant", content: retry.previous },
      {
        role: "user",
        content: `These figures don't appear in my answers: ${retry.untraced.join(", ")}. Rewrite the story using only numbers I gave, exactly as I wrote them. Remove any figure I didn't give. Reply with the same JSON shape.`,
      },
    );
  }
  return messages;
}

export function parseProbe(text: string): FollowUp[] {
  const json = extractJson(text);
  const list = isRecord(json) && Array.isArray(json.followUps) ? json.followUps : null;
  if (!list) throw new Error("The follow-up questions came back in an unexpected format.");

  const followUps = list
    .filter(isRecord)
    .map((f) => ({
      question: typeof f.question === "string" ? f.question.trim() : "",
      gap: typeof f.gap === "string" ? f.gap.trim().toLowerCase() : "",
    }))
    .filter((f) => f.question)
    .slice(0, 3);
  if (followUps.length === 0) throw new Error("No follow-up questions came back.");
  return followUps;
}

export function parseWrite(text: string): { title: string; parts: Record<StoryPartId, string> } {
  const json = extractJson(text);
  if (!isRecord(json) || !isRecord(json.parts)) {
    throw new Error("The story came back in an unexpected format.");
  }
  const rawParts = json.parts;
  const parts = Object.fromEntries(
    STORY_PARTS.map((p) => {
      const value = rawParts[p.id];
      return [p.id, typeof value === "string" ? value.trim() : ""];
    }),
  ) as Record<StoryPartId, string>;
  if (STORY_PARTS.every((p) => !parts[p.id])) throw new Error("The story came back empty.");
  const title = typeof json.title === "string" ? json.title.trim().slice(0, 120) : "";
  return { title, parts };
}

// Models sometimes wrap JSON in a code fence or a sentence; take the outermost object.
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

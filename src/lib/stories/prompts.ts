import type { ChatMessage } from "@/lib/ai/types";
import type { FollowUp, StoryContent } from "./content";
import {
  INTRO_PARTS,
  STAR_PARTS,
  coreQuestionText,
  coreQuestions,
  storyParts,
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
{"title": "…", "parts": {${STAR_PARTS.map((p) => `"${p.id}": "…"`).join(", ")}}}`;

// "Tell me about yourself" is a career introduction, not a story about one experience.
const INTRO_CHECKLIST = `- Present: their current role, company or industry, and scope (team, territory, budget) are clear.
- Path: the career moves that matter are there, with why they made them, not a list of every job.
- Highlight: at least one result in real terms with a concrete number, or an estimate labelled as one.
- Strengths: something specific they are known for, ideally with who relies on them for it.
- Next: why they want this kind of role next, tied to what came before, not just "a new challenge".`;

const INTRO_GAPS = INTRO_PARTS.map((p) => p.id);

export const INTRO_PROBE_SYSTEM = `You are an interview coach helping an experienced professional prepare their answer to "Tell me about yourself". They have answered a fixed set of questions about their career. Your job is to find the biggest gaps in their answers and ask follow-up questions that fill them. Sometimes they upload an answer they prepared earlier instead of answering the questions; review it against the same checklist.

Check the answers against this checklist:
${INTRO_CHECKLIST}

Rules:
- Ask 2 or 3 follow-up questions, aimed at the most important gaps first.
- If the highlight has no concrete number, one question must ask for one and suggest where they could find it (a dashboard, CRM, a performance review, a manager, an old email). Never suggest or guess a number yourself.
- Ask one thing per question. Keep each question short and conversational, and refer to their specifics so it's clear you read their answers.
- Don't repeat a question they already answered well.

Reply with JSON only, no other text:
{"followUps": [{"question": "…", "gap": "one of ${INTRO_GAPS.join(", ")}"}]}`;

export const INTRO_WRITE_SYSTEM = `You are an interview coach writing an experienced professional's answer to "Tell me about yourself", from their own answers.

The hard rule: use only facts and figures the user gave. Never add, round, inflate, convert or combine numbers. Copy every figure exactly as they wrote it, and keep words like "about" or "estimated" that they attached to it. If a detail is missing, leave it out; don't fill it in. Don't name customers, people or companies they didn't name.

If they uploaded a prepared answer, rework it into the parts below, keeping their wording where it already works and adding what their follow-up answers gave.

Write in the first person, in plain spoken English the user could say aloud at the start of an interview. It is a short career pitch, not a life story: present, then past, then where they're heading. Aim for about 150 to 220 words in total, 60 to 90 seconds spoken.

Write these parts:
- present: 1 to 2 sentences on who they are today: role, company or industry, and scope.
- path: 2 to 3 sentences on the career moves that led here and why, skipping anything that doesn't support the story.
- highlight: 1 to 2 sentences on the result they're proudest of, with their number.
- strengths: 1 sentence on what they're known for.
- next: 1 to 2 sentences on why they want this next role, which closes the answer and hands back to the interviewer.

Also give it a short title (at most 8 words) for their story bank, e.g. "From support lead to solutions architect".

Reply with JSON only, no other text:
{"title": "…", "parts": {${INTRO_PARTS.map((p) => `"${p.id}": "…"`).join(", ")}}}`;

export function probeSystem(storyType: StoryType | undefined): string {
  return storyType?.format === "intro" ? INTRO_PROBE_SYSTEM : PROBE_SYSTEM;
}

export function writeSystem(storyType: StoryType | undefined): string {
  return storyType?.format === "intro" ? INTRO_WRITE_SYSTEM : WRITE_SYSTEM;
}

// The user's answers as an interview transcript, for both calls.
export function answersTranscript(content: StoryContent, storyType: StoryType | undefined): string {
  const lines: string[] = [];
  if (storyType) lines.push(`Story type: ${storyType.label}`, "");
  if (content.imported) {
    lines.push("My prepared answer, uploaded from a file I wrote earlier:", content.imported.text.trim(), "");
  }
  for (const q of coreQuestions(storyType)) {
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

export function probeMessages(
  content: StoryContent,
  storyType: StoryType | undefined,
): ChatMessage[] {
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

export function parseWrite(
  text: string,
  storyType: StoryType | undefined,
): { title: string; parts: Record<string, string> } {
  const json = extractJson(text);
  if (!isRecord(json) || !isRecord(json.parts)) {
    throw new Error("The story came back in an unexpected format.");
  }
  const rawParts = json.parts;
  const expected = storyParts(storyType);
  const parts = Object.fromEntries(
    expected.map((p) => {
      const value = rawParts[p.id];
      return [p.id, typeof value === "string" ? value.trim() : ""];
    }),
  );
  if (expected.every((p) => !parts[p.id])) throw new Error("The story came back empty.");
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

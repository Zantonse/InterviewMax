import type { ChatMessage } from "@/lib/ai/types";
import { roleMapTranscript } from "@/lib/roles/role-map";
import type { FollowUp, StoryContent } from "./content";
import {
  INTRO_PARTS,
  INTRO_QUESTIONS,
  MAX_ANSWER_LENGTH,
  STAR_PARTS,
  coreQuestionText,
  coreQuestions,
  storyParts,
  type StoryType,
} from "./story-types";

// The two model calls in the story builder (PRD, step 4):
//   call one (storyProbe): read the answers and ask follow-ups aimed at the gaps, in up to two rounds
//   call two (storyWrite): write the story from the user's own answers, inventing nothing

const CHECKLIST = `- Situation: where they were, their role, and what was at stake are clear.
- Ownership: their own actions are separated from the team's ("I", not only "we").
- Actions: concrete steps, not generalities.
- Decision: where they chose between options, what the options were and why they chose.
- Result: an outcome in real terms with at least one concrete number, or an estimate labelled as one.
- Reflection: a specific lesson or something they'd do differently.`;

const GAPS = ["situation", "ownership", "actions", "decision", "result", "reflection"] as const;

// How hard both reviews push. Interviewers remember numbers and specifics, so the coach asks for
// them wherever an answer makes a claim without one.
const PROBE_RULES = `Rules:
- Push for numbers. Every claim that could be measured should be: a result needs the context that makes it impressive (percent of quota or target, rank out of how many, before and after); something they built or led needs reach (how many people, teams or customers use it); an improvement needs size (hours or days saved, percent faster, revenue or deals it touched); scope needs size (team, accounts, territory). When an answer has a bare number like "sold 4.3M", ask for the comparison that gives it weight.
- When they may not know a number offhand, say where they could find it (a CRM or dashboard, a performance review, their manager, an old email or award announcement) and that a labelled estimate is fine. Never suggest or guess a number yourself.
- Push for specifics. When an answer is generic ("people come to me for AI", "I improved engagements"), ask for one concrete example: what exactly, for whom, and what changed.
- Push for the why. Ask what drove a decision or a career move when it isn't clear.
- Ask one thing per question. Keep each question short and conversational, and refer to their specifics so it's clear you read their answers.
- Never repeat a question they already answered well, including earlier follow-ups.
- Prioritise: ask the questions that would most improve the answer first.`;

function roundInstructions(round: number): string {
  return round <= 1
    ? "This is the first round of follow-ups. Ask 3 to 5 questions."
    : `This is round ${round}, after they answered your earlier follow-ups. Ask up to 3 more questions only where a missing number, example or reason would still clearly weaken the answer. If the answer is already strong, return an empty list: {"followUps": []}.`;
}

export const PROBE_SYSTEM = `You are a demanding interview coach helping an experienced professional prepare one behavioral interview story. They have answered a fixed set of questions about one experience. Your job is to find what would make this story stronger and ask follow-up questions that get it.

Check the answers against this checklist:
${CHECKLIST}

${PROBE_RULES}

Reply with JSON only, no other text:
{"followUps": [{"question": "…", "gap": "one of ${GAPS.join(", ")}"}]}`;

export const WRITE_SYSTEM = `You are an interview coach writing a behavioral interview story for an experienced professional, from their own answers.

The hard rule: use only facts and figures the user gave. Never add, round, inflate, convert or combine numbers. Copy every figure exactly as they wrote it, and keep words like "about" or "estimated" that they attached to it. If a detail is missing, leave it out; don't fill it in. Don't name customers, people or companies they didn't name.

Write in the first person, in plain spoken English the user could say aloud, as if answering the interviewer. Use "I" for what they did themselves and "we" only for the team. Aim for about 250 to 300 words in total, about two minutes spoken.

Make it strong, not just accurate: put their most impressive numbers where they land hardest, use every relevant figure and concrete example they gave (including in their follow-up answers), and cut details that dilute the story. Prefer concrete verbs over filler and clichés, while keeping their voice.

Write these parts:
- situation: 2 to 3 sentences on the context and what was at stake.
- role: 1 to 2 sentences on what they owned and what they had to work with.
- actions: 3 to 5 sentences on the steps they took, including the choice they made and why.
- result: 1 to 2 sentences on the outcome, with their number.
- reflection: 1 to 2 sentences on what they learned or would do differently.

The parts are said one after another as a single answer, so write them to flow together with natural spoken transitions, without repeating anything between parts.

Also give the story a short title (at most 8 words) for their story bank, e.g. "Saving the Acme renewal".

Reply with JSON only, no other text:
{"title": "…", "parts": {${STAR_PARTS.map((p) => `"${p.id}": "…"`).join(", ")}}}`;

// "Tell me about yourself" is a career introduction, not a story about one experience.
const INTRO_CHECKLIST = `- Present: their current role, company or industry, and scope with a size (team, number of accounts or reps they support, territory or quota) are clear.
- Path: the career moves that matter are there, with why they made each one, not a list of every job.
- Highlight: at least one result with a concrete number AND the context that makes it impressive: against quota or target, a rank out of how many, or a before and after.
- Strengths: something specific they are known for, backed by an example with a number (how many people use what they built, time or money it saved, deals it helped win).
- Next: what role they want, why now, and how it connects to what they've already done.`;

const INTRO_GAPS = INTRO_PARTS.map((p) => p.id);

export const INTRO_PROBE_SYSTEM = `You are a demanding interview coach helping an experienced professional prepare their answer to "Tell me about yourself". They have answered a fixed set of questions about their career. Your job is to find what would make their answer stronger and ask follow-up questions that get it. Sometimes they upload an answer they prepared earlier instead of answering the questions; review it against the same checklist.

Check the answers against this checklist:
${INTRO_CHECKLIST}

${PROBE_RULES}

Reply with JSON only, no other text:
{"followUps": [{"question": "…", "gap": "one of ${INTRO_GAPS.join(", ")}"}]}`;

export const INTRO_WRITE_SYSTEM = `You are an interview coach writing an experienced professional's answer to "Tell me about yourself", from their own answers.

The hard rule: use only facts and figures the user gave. Never add, round, inflate, convert or combine numbers. Copy every figure exactly as they wrote it, and keep words like "about" or "estimated" that they attached to it. If a detail is missing, leave it out; don't fill it in. Don't name customers, people or companies they didn't name.

If they uploaded a prepared answer, rework it into the parts below, keeping their wording where it already works and adding what their follow-up answers gave.

Write in the first person, in plain spoken English the user could say aloud at the start of an interview. It is a short career pitch, not a life story: present, then past, then where they're heading. Aim for about 150 to 220 words in total, 60 to 90 seconds spoken.

Make it strong, not just accurate:
- Find the one thread that ties their career together and the role they want next, and let every part serve it.
- Open with who they are in a way that is specific to them, not a job title alone.
- Lead with their most impressive numbers and give each its context (against quota, rank, how many people, time saved). Use every relevant figure and concrete example they gave, including in their follow-up answers.
- Cut anything that doesn't support the thread, even if they mentioned it (an unrelated side interest dilutes the pitch).
- Prefer concrete verbs over filler and clichés, while keeping their voice.

Write these parts:
- present: 1 to 2 sentences on who they are today: role, company or industry, and scope.
- path: 2 to 3 sentences on the career moves that led here and why, skipping anything that doesn't support the story.
- highlight: 1 to 2 sentences on the result they're proudest of, with their number.
- strengths: 1 to 2 sentences on what they're known for, proved with their most concrete example.
- next: 1 to 2 sentences on why they want this next role, which closes the answer and hands back to the interviewer.

The parts are said one after another as a single answer, so write them to flow together with natural spoken transitions, without repeating anything between parts.

Also give it a short title (at most 8 words) for their story bank, e.g. "From support lead to solutions architect".

Reply with JSON only, no other text:
{"title": "…", "parts": {${INTRO_PARTS.map((p) => `"${p.id}": "…"`).join(", ")}}}`;

// Fills in the "Tell me about yourself" questions a LinkedIn profile already answers.
export const PREFILL_SYSTEM = `You are an interview coach helping an experienced professional prepare their answer to "Tell me about yourself". They uploaded their LinkedIn profile. Answer each question below from the profile only, written in the first person as notes they could have typed themselves.

The hard rule: use only what the profile says. Copy every number exactly as written in the profile, and never add, round, estimate or combine figures. If the profile doesn't answer a question, return an empty string for it; don't guess. Questions about what they want next or why are usually not in a profile, so leave those empty unless the profile states it.

Questions:
${INTRO_QUESTIONS.map((q) => `- ${q.id}: ${q.text}`).join("\n")}

Reply with JSON only, no other text:
{"answers": {${INTRO_QUESTIONS.map((q) => `"${q.id}": "…"`).join(", ")}}}`;

export function prefillMessages(profileText: string): ChatMessage[] {
  return [{ role: "user", content: `Here is my LinkedIn profile.\n\n${profileText}` }];
}

// Answers keyed by question id, keeping only known questions with a non-empty answer.
export function parsePrefill(text: string): Record<string, string> {
  const json = extractJson(text);
  if (!isRecord(json) || !isRecord(json.answers)) {
    throw new Error("The profile answers came back in an unexpected format.");
  }
  const raw = json.answers;
  return Object.fromEntries(
    INTRO_QUESTIONS.flatMap((q) => {
      const value = raw[q.id];
      const answer = typeof value === "string" ? value.trim() : "";
      return answer ? [[q.id, answer.slice(0, MAX_ANSWER_LENGTH)]] : [];
    }),
  );
}

export function probeSystem(storyType: StoryType | undefined, round = 1): string {
  const base = storyType?.format === "intro" ? INTRO_PROBE_SYSTEM : PROBE_SYSTEM;
  return `${base}\n\n${roundInstructions(round)}`;
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
  if (content.roleMap) lines.push(roleMapTranscript(content.roleMap), "");
  if (content.linkedin) {
    lines.push(
      "My LinkedIn profile, for background (the facts and figures in it are mine):",
      content.linkedin.text.trim(),
      "",
    );
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

export function parseProbe(text: string, round = 1): FollowUp[] {
  const json = extractJson(text);
  const list = isRecord(json) && Array.isArray(json.followUps) ? json.followUps : null;
  if (!list) throw new Error("The follow-up questions came back in an unexpected format.");

  const followUps = list
    .filter(isRecord)
    .map((f) => ({
      question: typeof f.question === "string" ? f.question.trim() : "",
      gap: typeof f.gap === "string" ? f.gap.trim().toLowerCase() : "",
      round,
    }))
    .filter((f) => f.question)
    .slice(0, round <= 1 ? 5 : 3);
  // A later round may say the answer is strong enough; the first must ask something.
  if (followUps.length === 0 && round <= 1) throw new Error("No follow-up questions came back.");
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

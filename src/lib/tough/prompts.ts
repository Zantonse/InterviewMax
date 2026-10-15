import type { ChatMessage } from "@/lib/ai/types";
import { TIGHT_RULES, extractJson } from "@/lib/stories/prompts";
import { TOUGH_LENGTH, type ToughQuestion } from "./questions";

// The one model call in the tough-questions coach (toughAnswer): write a short spoken answer to one
// awkward question from the user's own answers about their situation. True, brief, and turned
// toward the new role. The no-invented-facts rule is checked in code afterwards (coach.ts).

export const TOUGH_SYSTEM = `You are an interview coach helping an experienced professional answer one of the awkward interview questions people dread: why they're leaving, a gap, a layoff or firing, many job moves, their greatest weakness, a failure, or salary expectations. They have answered a few plain questions about their real situation. Write the short answer they will say out loud.

What a good answer is:
- True. Use only facts the user gave. Never add, round, inflate or combine numbers, and copy every figure exactly as they wrote it. Don't name people, companies or reasons they didn't name.
- Honest. Never suggest hiding, misstating or dodging a fact. No spin: if they were fired, the answer says so plainly in one sentence; if there was a gap, it names the gap. Coach what to say and how to move on, never how to cover something up.
- Brief. ${TOUGH_LENGTH.min} to ${TOUGH_LENGTH.max} words, about 20 to 40 seconds spoken. Never more than ${TOUGH_LENGTH.max} words. The interviewer should feel the question is answered and closed, not invite more digging.
- Calm and without apology. No "unfortunately", no over-explaining, no defensiveness.
- Fair to others. Never criticise a former employer, manager or colleague, even if the user did in their answers. Say what they want next instead of what was wrong, as long as it stays true.
- Private where it should be. Health, family, pregnancy, religion and other personal matters are never needed: if that was the reason, say it at the level of "a family matter" or "a health matter, now behind me", and only if the user said that's what it was. The user may decline personal questions.
- Forward. End with one line that turns toward the new role: what they want next and why this role has it, from their own answers and the job posting when one is given. Never invent reasons about the company that aren't in the posting.
- First person, in the user's own voice, plain spoken English. No headings, bullet points or stage directions.

For each question:
- Why leaving: one honest reason said without complaint, then what they want next. If they've already left, say so.
- A gap: name it and its reason in one sentence, anything they did in it, then that they're ready and why this role.
- Laid off or let go: a layoff is stated with its wider context when they gave one. A firing is stated plainly: own their part in a sentence, say what they changed, then move on. Don't call a firing a layoff.
- Many moves: the honest reason in a line, the thread that connects the moves, and why this role is one they'd stay in.
- Greatest weakness: a real weakness, not a disguised strength like "perfectionism" or "working too hard". One short example, then what they do about it now. If what they gave is a disguised strength, still write it as honestly as you can and say so in the note.
- A failure: what went wrong and their own part, no blame on others, what they did next, and what they do differently now.
- Salary expectations: a calm script for the question, not negotiation advice. If they gave a range, use exactly their figures and say whether it's base or total pay as they did. If they'd rather hear the company's range first, or gave no range, politely ask for the range budgeted for the role and say the whole package matters. Never suggest a number they didn't give.

${TIGHT_RULES}

Also write a short note for the user (one or two sentences, speaking to them as "you"): why the answer is built this way, and one thing to watch for when they say it, such as a follow-up the interviewer may ask. If an important fact is missing or vague in their answers, say what to add instead of guessing it.

Reply with JSON only, no other text:
{"answer": "…", "note": "…"}`;

export type ToughJob = {
  title: string;
  company: string | null;
  description: string;
};

// How much of a job posting goes to the writer: enough to turn the answer toward the role.
const POSTING_EXCERPT = 2500;

export function toughMessages(input: {
  question: ToughQuestion;
  answers: Record<string, string>;
  job: ToughJob | null;
  // When retrying: what was wrong with the last answer.
  fix?: string;
}): ChatMessage[] {
  const { question, answers, job } = input;
  const qa = question.prompts
    .map((p) => {
      const answer = answers[p.id]?.trim();
      return `Q: ${p.text}\nA: ${answer || "(skipped)"}`;
    })
    .join("\n\n");
  const jobText = job
    ? `The role they're interviewing for: ${job.title}${job.company ? ` at ${job.company}` : ""}.${
        job.description.trim()
          ? `\n\nJob posting (excerpt):\n${job.description.trim().slice(0, POSTING_EXCERPT)}`
          : ""
      }`
    : "No specific role is given; turn toward the kind of role they say they want.";
  const parts = [
    `The interview question: "${question.label}"`,
    `What a good answer does here: ${question.approach}`,
    jobText,
    `Their answers about their situation:\n\n${qa}`,
  ];
  if (input.fix) parts.push(`Your last answer needs fixing: ${input.fix}`);
  return [{ role: "user", content: parts.join("\n\n") }];
}

export function parseToughReply(text: string): { answer: string; note: string } {
  const json = extractJson(text);
  if (!isRecord(json) || typeof json.answer !== "string" || !json.answer.trim()) {
    throw new Error("The answer came back empty.");
  }
  return {
    answer: json.answer.trim(),
    note: typeof json.note === "string" ? json.note.trim() : "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import type { ChatMessage } from "@/lib/ai/types";
import { isRecord, levelLabel } from "@/lib/jobs/content";
import { extractJson } from "@/lib/stories/prompts";
import {
  AUDIENCES,
  MAX_SUGGESTIONS,
  MIN_SUGGESTIONS,
  isOfferStageQuestion,
  parseAskList,
  type AskQuestion,
} from "./content";

// The model call in questions to ask ("askQuestions"): five to eight questions the candidate can
// ask at the end of an interview for one target job, each drawn from the posting, the company and
// the level, and marked with who in the loop it suits. Pay and benefits questions are dropped in
// code: those belong after an offer.

export const ASK_QUESTIONS_SYSTEM = `You are an interview coach. Every interview ends with "Do you have any questions for us?". You write the questions one candidate should ask at the end of their interviews for one specific job, so they come across as curious, prepared and already thinking about the work.

Who a question suits:
${AUDIENCES.map((a) => `- ${a.id} (${a.label}): ${a.hint}`).join("\n")}

Rules:
- Return ${MIN_SUGGESTIONS} to ${MAX_SUGGESTIONS} questions. Cover at least three of the four audiences, with the most for hiring_manager.
- Draw each one from something specific in the posting (a responsibility it leads with, a product, a team, a change it mentions, a skill it stresses) and name that thing in the question, so it could only be asked about this job.
- Never ask what the posting already answers.
- Match the level: for senior and leadership roles, ask about scope, decisions, trade-offs and direction; for earlier-career roles, ask about learning, feedback and what good work looks like.
- Open questions only (how, what, which), one question each, under 30 words, in plain spoken English. No yes/no questions, no flattery, no questions about the candidate themselves except at most one closing question about next steps or concerns.
- Never ask about salary, pay, benefits, time off or perks: those belong after an offer.
- Don't invent facts about the company that the posting, the notes or the interview reports don't state.
- If the candidate already has questions, don't repeat them or ask the same thing in other words.
- why is a few words on what in the posting the question comes from (e.g. "posting leads with partner launches").

Reply with JSON only, no other text:
{"questions": [{"question": "…", "audience": "one of ${AUDIENCES.map((a) => a.id).join(", ")}", "why": "…"}]}`;

export function askQuestionsMessages(input: {
  job: {
    title: string;
    company: string | null;
    level: string | null;
    description: string;
  };
  // What the read of the user's jobs says this job's interviewers will look for.
  focus: string[];
  reports: string;
  // Questions the candidate already has for this job (saved or their own).
  existing: string[];
}): ChatMessage[] {
  const { job, focus, reports, existing } = input;
  const level = levelLabel(job.level);
  const lines = [
    `## The job: ${job.title}${job.company ? ` at ${job.company}` : ""}${level ? ` (${level})` : ""}`,
    job.description.trim(),
  ];
  if (focus.length > 0) {
    lines.push(
      "",
      `## What their interviewers will look for\n${focus.map((f) => `- ${f}`).join("\n")}`,
    );
  }
  if (reports.trim()) {
    lines.push("", `## Interview reports I found for this company or role\n${reports.trim()}`);
  }
  if (existing.length > 0) {
    lines.push("", `## Questions I already have\n${existing.map((q) => `- ${q}`).join("\n")}`);
  }
  return [
    {
      role: "user",
      content: `Write the questions I should ask at the end of my interviews.\n\n${lines.join("\n")}`,
    },
  ];
}

export function parseAskQuestionsReply(text: string): AskQuestion[] {
  const json = extractJson(text);
  if (!isRecord(json)) throw new Error("The questions came back in an unexpected format.");
  const raw = Array.isArray(json.questions) ? json.questions : [];
  const questions = parseAskList(
    raw.filter(
      (q) => isRecord(q) && typeof q.question === "string" && !isOfferStageQuestion(q.question),
    ),
    MAX_SUGGESTIONS,
  ).map(({ id, question, audience, why }) => ({
    id,
    question,
    audience,
    why,
    saved: false,
  }));
  if (questions.length === 0) throw new Error("No questions came back.");
  return questions;
}

import type { ChatMessage } from "@/lib/ai/types";
import { isRecord } from "@/lib/jobs/content";
import { untracedNumbers } from "@/lib/stories/numbers";
import { extractJson } from "@/lib/stories/prompts";
import { CASE_FRAMES, type CaseFeedback, type CaseKind } from "./content";

// The one model call in case practice ("casePractice"): feedback on a practice answer to a case or
// skills question, against the scripted frame, plus the follow-up an interviewer would push with.
// It coaches the shape of the answer and never supplies experience: a figure that isn't in the
// question or the answer is dropped in code.

export const CASE_PRACTICE_SYSTEM = `You are an interview coach. The candidate is practicing a case or skills question from a real interview: a business problem to reason through, or a check on a tool or skill. They answered it out loud or in writing. Give short, specific feedback so the next try is better.

Judge the answer against the frame you're given (its steps, in order). For each step, decide whether the answer covered it. Then:
- summary: one sentence on how the answer would land with the interviewer, naming the strongest part.
- covered: the ids of the steps the answer covered.
- missing: up to 3 things to add, most important first, each {"step": a step id, "tip": one sentence saying what to add, concretely, for this question}. For a case question, tips may suggest what to look at or test (e.g. "Compare stores with and without the new line in the same region and season"). For a skills question, tips are about how to say it, never claims of skill.
- followUp: the one follow-up a skeptical interviewer would ask next, in their words.

Rules:
- Never invent the candidate's experience, employers, tools or results. Don't put numbers in tips unless they appear in the question or the answer.
- If the answer hedges a lot ("I think", "kind of", "maybe"), say so in a tip and suggest a plainer opening.
- Speak to the candidate as "you", in plain English.

Reply with JSON only, no other text:
{"summary": "…", "covered": ["…"], "missing": [{"step": "…", "tip": "…"}], "followUp": "…"}`;

export function casePracticeMessages(input: {
  question: string;
  kind: CaseKind;
  answer: string;
  job: { title: string; company: string | null } | null;
}): ChatMessage[] {
  const frame = CASE_FRAMES[input.kind];
  const steps = frame.steps.map((s) => `- ${s.id}: ${s.label}. ${s.hint}`).join("\n");
  return [
    {
      role: "user",
      content: [
        input.job ? `Role: ${input.job.title}${input.job.company ? ` at ${input.job.company}` : ""}` : "",
        `Question type: ${frame.label}\nFrame:\n${steps}`,
        `The question: ${input.question.trim()}`,
        `My answer:\n${input.answer.trim()}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}

export function parseCasePracticeReply(
  text: string,
  input: { question: string; kind: CaseKind; answer: string },
): CaseFeedback {
  const json = extractJson(text);
  if (!isRecord(json)) throw new Error("The feedback came back in an unexpected format.");
  const ids = new Set(CASE_FRAMES[input.kind].steps.map((s) => s.id));
  const source = `${input.question}\n${input.answer}`;
  const traced = (line: string) => untracedNumbers(line, source).length === 0;
  const str = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 400) : "");

  const covered = (Array.isArray(json.covered) ? json.covered : []).filter(
    (c): c is string => typeof c === "string" && ids.has(c),
  );
  const missing = (Array.isArray(json.missing) ? json.missing : [])
    .flatMap((m) => {
      if (!isRecord(m)) return [];
      const step = str(m.step);
      const tip = str(m.tip);
      return ids.has(step) && tip && traced(tip) ? [{ step, tip }] : [];
    })
    .slice(0, 3);
  const summary = str(json.summary);
  const followUp = str(json.followUp);
  if (!summary && missing.length === 0) throw new Error("The feedback came back empty. Try again.");
  return {
    summary: traced(summary) ? summary : "",
    covered: [...new Set(covered)],
    missing,
    followUp: traced(followUp) ? followUp : "",
  };
}

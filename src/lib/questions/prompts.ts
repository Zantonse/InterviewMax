import type { ChatMessage } from "@/lib/ai/types";
import { levelLabel } from "@/lib/jobs/content";
import { extractJson } from "@/lib/stories/prompts";
import { isRecord } from "@/lib/jobs/content";
import { MAX_QUESTIONS, parseQuestionList, type LikelyQuestion } from "./content";
import { QUESTION_THEMES } from "./themes";

// The model call in likely questions ("likelyQuestions"): predict the behavioral questions one
// target job is most likely to ask, starting from the scripted themes and templates, tailored by
// the posting and any interview reports the user pasted. Reports are pasted, never scraped.

export const LIKELY_QUESTIONS_SYSTEM = `You are an interview coach predicting the behavioral interview questions one specific job is most likely to ask, so the candidate can spend limited prep time on the questions that matter.

Start from these ten themes and their standard questions:
${QUESTION_THEMES.map((t) => `- ${t.id} (${t.label}): ${t.templates.join(" | ")}`).join("\n")}

Rules:
- Return ${MAX_QUESTIONS - 2} to ${MAX_QUESTIONS} questions, most likely first. Always include "Tell me about yourself" (theme about_you).
- Tailor the wording to this job: name its real situations (its customers, teams, products, scope) where the posting gives them, so the question sounds like this company's interviewer asked it.
- Rank by what the posting stresses most (repeated themes, the first responsibilities listed, the level) and by what the interview reports say was actually asked.
- If interview reports are given, include the behavioral questions they report, marked source "report". Ignore technical, case or coding questions: only behavioral ones belong here.
- source is "report" for a question from the reports, "posting" for one shaped by something in the posting, "common" for a standard question asked almost everywhere.
- specific is true when the question comes from something only this job asks for, not shared with the candidate's other target jobs. Always false when there are no other jobs.
- why is a few words on why it's likely, pointing at the posting or report (e.g. "posting leads with partner enablement").
- Every question is behavioral (about the candidate's past experience or how they work), one question each, in plain spoken English.
- Don't invent facts about the company that the posting or reports don't state.

Reply with JSON only, no other text:
{"questions": [{"question": "…", "theme": "one of ${QUESTION_THEMES.map((t) => t.id).join(", ")}", "why": "…", "source": "common|posting|report", "specific": false}]}`;

export function likelyQuestionsMessages(input: {
  job: { title: string; company: string | null; level: string | null; description: string };
  otherJobs: { title: string; company: string | null }[];
  shared: string[];
  reports: string;
}): ChatMessage[] {
  const { job, otherJobs, shared, reports } = input;
  const level = levelLabel(job.level);
  const lines = [
    `## The job: ${job.title}${job.company ? ` at ${job.company}` : ""}${level ? ` (${level})` : ""}`,
    job.description.trim(),
    "",
    otherJobs.length > 0
      ? `## My other target jobs\n${otherJobs.map((j) => `- ${j.title}${j.company ? ` at ${j.company}` : ""}`).join("\n")}`
      : "This is my only target job.",
  ];
  if (shared.length > 0) {
    lines.push("", `## What my target jobs share\n${shared.map((s) => `- ${s}`).join("\n")}`);
  }
  lines.push(
    "",
    reports.trim()
      ? `## Interview reports I found for this company or role\n${reports.trim()}`
      : "I haven't found any interview reports.",
  );
  return [{ role: "user", content: `Predict my likely behavioral questions.\n\n${lines.join("\n")}` }];
}

export function parseLikelyQuestionsReply(
  text: string,
  { hasOtherJobs, hasReports }: { hasOtherJobs: boolean; hasReports: boolean },
): LikelyQuestion[] {
  const json = extractJson(text);
  if (!isRecord(json)) throw new Error("The questions came back in an unexpected format.");
  const questions = parseQuestionList(json.questions).map((q) => ({
    ...q,
    specific: hasOtherJobs && q.specific,
    // Without reports, nothing can have come from one.
    source: !hasReports && q.source === "report" ? ("posting" as const) : q.source,
  }));
  if (questions.length === 0) throw new Error("No questions came back.");
  return questions;
}

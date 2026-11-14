import type { ChatMessage } from "@/lib/ai/types";
import { levelLabel } from "@/lib/jobs/content";
import { extractJson } from "@/lib/stories/prompts";
import { isRecord } from "@/lib/jobs/content";
import {
  MAX_QUESTIONS,
  REPORTS_HEADING,
  REPORTS_HEDGE_RULE,
  parseQuestionList,
  withAiUseQuestion,
  type LikelyQuestion,
} from "./content";
import { AI_USE_QUESTION, QUESTION_THEMES } from "./themes";

// The model call in likely questions ("likelyQuestions"): predict the behavioral questions one
// target job is most likely to ask, starting from the scripted themes and templates, tailored by
// the posting and any interview reports the user pasted. Reports are pasted, never scraped.

export const LIKELY_QUESTIONS_SYSTEM = `You are an interview coach predicting the behavioral interview questions one specific job is most likely to ask, so the candidate can spend limited prep time on the questions that matter.

Start from these ${QUESTION_THEMES.length} themes and their standard questions:
${QUESTION_THEMES.map((t) => `- ${t.id} (${t.label}): ${t.templates.join(" | ")}`).join("\n")}

Rules:
- Return ${MAX_QUESTIONS - 2} to ${MAX_QUESTIONS} questions, most likely first. Always include "Tell me about yourself" (theme about_you), and a question on using AI at work (theme ${AI_USE_QUESTION.theme}): interviewers now ask it in most roles, so word it for this job (e.g. "${AI_USE_QUESTION.question}").
- Tailor the wording to this job: name its real situations (its customers, teams, products, scope) where the posting gives them, so the question sounds like this company's interviewer asked it.
- Rank by what the posting stresses most (repeated themes, the first responsibilities listed, the level) and by what the interview reports say was actually asked.
- If interview reports are given, include the behavioral questions they say were actually asked, marked source "report". Ignore technical, case or coding questions: only behavioral ones belong here.
- A guess about what an interviewer might ask, or advice on what to bring up, is not a reported question: let it shape the ranking and wording, but mark that question "posting" or "common", never "report", and say in why that it's someone's guess (e.g. "a former team member guesses design systems come up").
${REPORTS_HEDGE_RULE}
- If the candidate gives questions they were actually asked in their own earlier interviews for this job or company, rank them high: interviewers there are likely to ask them again in a later round. Mark those source "transcript".
- Questions from their interviews elsewhere show what interviewers tend to ask someone with their background; use them to rank the themes, but mark a question "transcript" only when it came from this job or company.
- source is "transcript" for a question from their own interviews for this job or company, "report" for a question from the reports, "posting" for one shaped by something in the posting, "common" for a standard question asked almost everywhere.
- specific is true when the question comes from something only this job asks for, not shared with the candidate's other target jobs. Always false when there are no other jobs.
- why is a few words on why it's likely, pointing at the posting or report (e.g. "posting leads with partner enablement").
- Every question is behavioral (about the candidate's past experience or how they work), one question each, in plain spoken English.
- Don't invent facts about the company that the posting or reports don't state.
- stages lists the interview stages where it's most likely asked, most likely first, from: recruiter (a recruiter or talent partner screening for fit, motivation, the headline of their experience; few deep behavioral questions), hiring_manager (the person they'd report to, digging into how they work, what they owned and how they decide), panel (peers and partner teams, often one area each: collaboration, conflict, influence), final (a senior leader: judgment, scope, why this company). "Tell me about yourself" is asked at every stage; most questions belong to one or two. Use the interview reports or the candidate's past interviews when they say which round asked what.
- If other roles at the same company are listed, the candidate is in one interview process for all of them and is aiming for the main role (the job above). Rank and word the questions for the main role's level, and include one question that tests what the main role asks for beyond the others (the bigger scope, customers or experience its posting names). role is the exact title of the one role a question is only for; leave it out when the question applies to all of them, which is most of the time.

Reply with JSON only, no other text:
{"questions": [{"question": "…", "theme": "one of ${QUESTION_THEMES.map((t) => t.id).join(", ")}", "why": "…", "source": "common|posting|report|transcript", "specific": false, "stages": ["recruiter|hiring_manager|panel|final", "…"], "role": "only when it's for one role"}]}`;

export function likelyQuestionsMessages(input: {
  job: { title: string; company: string | null; level: string | null; description: string };
  // Other roles at the same company in this job, with the lines of their postings that differ
  // from the main one (the rest is the same text).
  otherRoles?: { title: string; level: string | null; differs: string[] }[];
  otherJobs: { title: string; company: string | null }[];
  shared: string[];
  reports: string;
  // Questions the user was asked in their own past interviews, from their transcripts.
  past?: { thisJob: string[]; elsewhere: string[] };
}): ChatMessage[] {
  const { job, otherRoles = [], otherJobs, shared, reports, past } = input;
  const level = levelLabel(job.level);
  const lines = [
    `## The job: ${job.title}${job.company ? ` at ${job.company}` : ""}${level ? ` (${level})` : ""}`,
    job.description.trim(),
    "",
  ];
  if (otherRoles.length > 0) {
    lines.push(
      `## Other roles at ${job.company || "this company"} I'm also being considered for\nThe job above is my main role, the one I'm aiming for. These are in the same process; their postings match the main one except for these lines.`,
      ...otherRoles.map((r) => {
        const level = levelLabel(r.level);
        const differs = r.differs.length ? r.differs.map((d) => `  - ${d}`).join("\n") : "  - (same posting)";
        return `- ${r.title}${level ? ` (${level})` : ""}\n${differs}`;
      }),
      "",
    );
  }
  lines.push(
    otherJobs.length > 0
      ? `## My other target jobs\n${otherJobs.map((j) => `- ${j.title}${j.company ? ` at ${j.company}` : ""}`).join("\n")}`
      : "This is my only target job.",
  );
  if (shared.length > 0) {
    lines.push("", `## What my target jobs share\n${shared.map((s) => `- ${s}`).join("\n")}`);
  }
  lines.push(
    "",
    reports.trim()
      ? `## ${REPORTS_HEADING}\n${reports.trim()}`
      : "I haven't found any interview reports.",
  );
  if (past && past.thisJob.length > 0) {
    lines.push(
      "",
      `## Questions I was asked in my own earlier interviews for this job or company\n${past.thisJob.map((q) => `- ${q}`).join("\n")}`,
    );
  }
  if (past && past.elsewhere.length > 0) {
    lines.push(
      "",
      `## Questions I was asked in my interviews at other companies\n${past.elsewhere.map((q) => `- ${q}`).join("\n")}`,
    );
  }
  return [{ role: "user", content: `Predict my likely behavioral questions.\n\n${lines.join("\n")}` }];
}

export function parseLikelyQuestionsReply(
  text: string,
  {
    hasOtherJobs,
    hasReports,
    hasPastForJob = false,
    roles = [],
  }: { hasOtherJobs: boolean; hasReports: boolean; hasPastForJob?: boolean; roles?: string[] },
): LikelyQuestion[] {
  // A role tag only means something when the job holds several roles, and only for one of them.
  const roleTitle = (role: string | undefined) =>
    roles.length > 1 ? roles.find((r) => r.toLowerCase() === role?.toLowerCase()) : undefined;
  const json = extractJson(text);
  if (!isRecord(json)) throw new Error("The questions came back in an unexpected format.");
  const questions = parseQuestionList(json.questions).map(({ role, ...q }) => ({
    ...q,
    ...(roleTitle(role) ? { role: roleTitle(role) } : {}),
    specific: hasOtherJobs && q.specific,
    // Without reports or transcripts for this job, nothing can have come from one.
    source:
      !hasReports && q.source === "report"
        ? ("posting" as const)
        : !hasPastForJob && q.source === "transcript"
          ? ("common" as const)
          : q.source,
  }));
  if (questions.length === 0) throw new Error("No questions came back.");
  return withAiUseQuestion(questions);
}

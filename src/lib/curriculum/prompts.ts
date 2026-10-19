import type { ChatMessage } from "@/lib/ai/types";
import { quoteIsIn } from "@/lib/finder/content";
import { isRecord, levelLabel } from "@/lib/jobs/content";
import { extractJson } from "@/lib/stories/prompts";
import {
  AREAS,
  MAX_BASICS,
  MAX_TOPICS,
  MIN_TOPICS,
  parseTopics,
  withConfidence,
  type CurriculumTopic,
} from "./content";

// The model call behind the job curriculum ("jobCurriculum"): the topics a candidate should know
// for one target job's interviews, by area, each with the basics, how it comes up and a question
// to check themselves with. Quotes are checked against the posting in code; a quote that isn't
// there word for word is dropped and the topic shows as usual for the role.

export const CURRICULUM_SYSTEM = `You are an interview coach. A candidate has an interview for one specific job and wants to be sure they know the basics of the job: the topics an interviewer could expect them to understand, so nothing catches them out. You write a short study list for that job.

Areas:
${AREAS.map((a) => `- ${a.id} (${a.label}): ${a.hint}`).join("\n")}

Rules:
- Return ${MIN_TOPICS} to ${MAX_TOPICS} topics across the areas, the ones the posting stresses first. Cover the role area with at least one topic about what the job is for and how its success is judged.
- Each topic is something to know, named in a few words (e.g. "Pricing experiments", "SOC 2 basics", "Partner onboarding"), not a skill to claim.
- quote: copy, word for word, the line or phrase of the posting the topic comes from. If the topic isn't named in the posting but is usual for this kind of role at this level, leave quote empty.
- basics: up to ${MAX_BASICS} short points a well-prepared candidate would know about the topic, in plain words: what it is, why it matters in this job, the key terms and trade-offs. General knowledge only: never state facts about this company (its numbers, customers, products, plans) that the posting or the notes don't state.
- askedAs: one line on how it tends to come up in an interview for this level (a behavioral question, a case, a technical question, a "how would you…").
- check: one question the candidate can ask themselves to test whether they really know it.
- Match the level: for senior and leadership roles, stress strategy, trade-offs and leading others; for earlier-career roles, the fundamentals and how the work is done.
- summary: two or three plain sentences on what this job is and what it will be judged on, from the posting.

Reply with JSON only, no other text:
{"summary": "…", "topics": [{"area": "one of ${AREAS.map((a) => a.id).join(", ")}", "name": "…", "quote": "…", "basics": ["…"], "askedAs": "…", "check": "…"}]}`;

export function curriculumMessages(input: {
  job: {
    title: string;
    company: string | null;
    level: string | null;
    description: string;
  };
  // What the read of the user's jobs says this job's interviewers will look for.
  focus: string[];
  reports: string;
}): ChatMessage[] {
  const { job, focus, reports } = input;
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
  return [
    {
      role: "user",
      content: `Write the study list for my interviews for this job.\n\n${lines.join("\n")}`,
    },
  ];
}

// The model's reply, checked: valid topics only, and each quote kept only if it is in the posting.
export function parseCurriculumReply(
  text: string,
  posting: string,
): { summary: string; topics: CurriculumTopic[] } {
  const json = extractJson(text);
  if (!isRecord(json)) throw new Error("The curriculum came back in an unexpected format.");
  const topics = parseTopics(json.topics).map((t) => ({
    ...withConfidence(t, undefined),
    quote: t.quote && quoteIsIn(t.quote, posting) ? t.quote : "",
  }));
  if (topics.length === 0) throw new Error("No topics came back.");
  const summary =
    typeof json.summary === "string" ? json.summary.replace(/\s+/g, " ").trim().slice(0, 600) : "";
  return { summary, topics };
}

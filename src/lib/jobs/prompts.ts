import type { ChatMessage } from "@/lib/ai/types";
import { untracedNumbers } from "@/lib/stories/numbers";
import { extractJson } from "@/lib/stories/prompts";
import { STORY_TYPES } from "@/lib/stories/story-types";
import {
  completeStoryOrder,
  isRecord,
  levelLabel,
  storyPriorities,
  type JobRead,
  type JobsOverview,
  type Resume,
} from "./content";

// The one model call in target jobs (PRD, step 1, "jobsRead"): read the resume and every job
// description together, find what the roles share and where each differs, and rank the story
// types these jobs need most.

export type JobForPrompt = {
  id: string;
  title: string;
  company: string | null;
  level: string | null;
  description: string;
};

export const JOBS_READ_SYSTEM = `You are an interview coach setting up an experienced professional's behavioral interview prep. They gave you the job postings they are going for and, sometimes, their resume. Read them together and work out what their interviewers will probe, so their limited prep time goes where it counts.

The hard rule: use only what the postings and resume say. Never invent facts about the candidate or the companies. If you mention a number, copy it exactly as written; never add, round or estimate one.

Return:
- shared: 3 to 5 short points on what these roles have in common that behavioral interviewers will probe (skills, scope, ways of working). With one job, what that job's interviewers will probe most.
- jobs: for each job, by its key:
  - summary: one sentence on what the role is, in plain words.
  - differs: one sentence on how it differs from the other jobs (its emphasis, scope, level or customers). Empty string when there is only one job.
  - focus: 3 to 5 things this job's interviewers will look for, each a few words, grounded in the posting.
- resumeFit (only when there is a resume): strengths are up to 4 things in the resume that match what the jobs need, each naming the resume evidence; gaps are up to 3 things the jobs ask for that the resume doesn't show yet. Omit resumeFit when there is no resume.
- storyOrder: the story types below, most needed by these jobs first, each with a few words on why. List every type once.

Story types:
${STORY_TYPES.map((t) => `- ${t.id}: ${t.label} (${t.blurb})`).join("\n")}

Write for the candidate ("you"), briefly and concretely, without filler.

Reply with JSON only, no other text:
{"shared": ["…"], "jobs": {"job1": {"summary": "…", "differs": "…", "focus": ["…"]}}, "resumeFit": {"strengths": ["…"], "gaps": ["…"]}, "storyOrder": [{"storyType": "…", "why": "…"}]}`;

// Jobs are numbered job1, job2… in the prompt rather than sent by id.
export function jobKey(index: number): string {
  return `job${index + 1}`;
}

export function jobsReadMessages(jobs: JobForPrompt[], resume: Resume | null): ChatMessage[] {
  const lines: string[] = [];
  jobs.forEach((job, i) => {
    const level = levelLabel(job.level);
    lines.push(
      `## ${jobKey(i)}: ${job.title}${job.company ? ` at ${job.company}` : ""}${level ? ` (${level})` : ""}`,
      job.description.trim(),
      "",
    );
  });
  lines.push(resume ? `## My resume\n${resume.text.trim()}` : "I haven't added a resume.");
  return [
    {
      role: "user",
      content: `Here are the jobs I'm going for.\n\n${lines.join("\n")}`,
    },
  ];
}

// Everything the read may quote figures from.
export function sourceText(jobs: JobForPrompt[], resume: Resume | null): string {
  return [...jobs.flatMap((j) => [j.title, j.company ?? "", j.description]), resume?.text ?? ""].join(
    "\n",
  );
}

export function parseJobsRead(
  text: string,
  jobs: JobForPrompt[],
  source: string,
  hasResume: boolean,
): Pick<JobsOverview, "shared" | "jobs" | "resumeFit" | "storyOrder"> {
  const json = extractJson(text);
  if (!isRecord(json) || !isRecord(json.jobs)) {
    throw new Error("The read of your jobs came back in an unexpected format.");
  }
  // A line with a figure that isn't in the postings or resume is dropped, not shown.
  const traced = (lines: unknown, max: number) =>
    (Array.isArray(lines) ? lines : [])
      .filter((l): l is string => typeof l === "string" && l.trim() !== "")
      .map((l) => l.trim())
      .filter((l) => untracedNumbers(l, source).length === 0)
      .slice(0, max);
  const tracedLine = (line: unknown) => traced([line], 1)[0] ?? "";

  const rawJobs = json.jobs;
  const read: Record<string, JobRead> = {};
  jobs.forEach((job, i) => {
    const raw = rawJobs[jobKey(i)];
    if (!isRecord(raw)) return;
    read[job.id] = {
      summary: tracedLine(raw.summary),
      differs: jobs.length > 1 ? tracedLine(raw.differs) : "",
      focus: traced(raw.focus, 5),
    };
  });
  if (Object.keys(read).length === 0) throw new Error("The read of your jobs came back empty.");

  const fit =
    hasResume && isRecord(json.resumeFit)
      ? { strengths: traced(json.resumeFit.strengths, 4), gaps: traced(json.resumeFit.gaps, 3) }
      : undefined;

  return {
    shared: traced(json.shared, 5),
    jobs: read,
    ...(fit ? { resumeFit: fit } : {}),
    storyOrder: completeStoryOrder(storyPriorities(json.storyOrder)),
  };
}

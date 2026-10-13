import type { ChatMessage } from "@/lib/ai/types";
import { levelLabel } from "@/lib/jobs/content";
import { extractJson } from "./prompts";
import type { StoryType } from "./story-types";

// The content check: a second grading call that reads the story against the user's target jobs
// and their own answers. It judges whether this is the right story, not how well it is told:
//   - which of each job's requirements the story proves, and which it leaves out
//   - which of each job's likely questions it answers well
//   - whether the level the story signals matches the job's level (a hands-on story for a principal
//     role is noted, not failed: the PRD judges level across the bank)
//   - strong facts from the user's answers that the written story left out
// It doesn't change the tier.

export const FIT_LEVELS = ["strong", "partial", "weak"] as const;
export type FitLevel = (typeof FIT_LEVELS)[number];

export const LEVEL_MATCH = ["below", "matches", "above"] as const;
export type LevelMatch = (typeof LEVEL_MATCH)[number];

export type JobFit = {
  jobId: string;
  title: string;
  company: string;
  fit: FitLevel;
  // What the job asks for that the story proves, and what it asks for that the story doesn't.
  proves: string[];
  misses: string[];
  // Likely questions for this job the story answers well, as written on the job.
  answers: string[];
  level?: { match: LevelMatch; note: string };
};

export type ContentCheck = {
  jobs: JobFit[];
  // Strong facts from the user's answers that aren't in the story.
  unused: string[];
  model: string;
};

// What the check needs to know about each target job.
export type FitJob = {
  id: string;
  title: string;
  company: string | null;
  level: string | null;
  // What interviewers for this job will look for (from the jobs read), or the posting itself.
  focus: string[];
  description: string;
  questions: string[];
};

export const MAX_FIT_JOBS = 5;
const MAX_DESCRIPTION_IN_PROMPT = 3000;
const MAX_ANSWERS_IN_PROMPT = 20000;

export const FIT_SYSTEM = `You are an interview coach checking whether a candidate's story is the right story for the jobs they're going for. Another coach has already graded how well it is told; don't grade the telling. Judge the content: what it proves about the candidate, against what each job needs.

For each job:
- fit: "strong" if the story proves one or more things this job's interviewers care most about; "partial" if it proves something relevant but not the core of the job; "weak" if it proves little this job needs.
- proves: up to 3 things the job needs that this story proves, each naming the job's need and the part of the story that proves it, in one short sentence.
- misses: up to 3 things the job needs most that this story doesn't prove, phrased as what the job wants (e.g. "Leading a technical evaluation for a large enterprise deal"). Only list what a story of this kind could reasonably show.
- answers: the numbers of the likely questions this story would answer well, if any. Only include a question when this story is a natural, strong answer to it.
- level: when the job has a level, say whether the scope of the story (hands-on work, a team-level result, or organization-level impact) is "below", "matches" or "above" what that level is expected to show, with one short sentence on why. A hands-on story can still be useful at a senior level; say so plainly when it is.

Then list up to 3 strong facts in the candidate's own answers that the written story leaves out and that would help with these jobs (a number, a named example, a result). Quote or name them from the answers; never invent or change a fact or a number. Return an empty list when the story already uses the best material.

Be specific and brief. Address the candidate as "you".

Reply with JSON only, no other text:
{"jobs": {"j1": {"fit": "strong", "proves": ["…"], "misses": ["…"], "answers": [1], "level": {"match": "matches", "note": "…"}}}, "unused": ["…"]}`;

export function fitMessages(input: {
  storyText: string;
  answers: string;
  jobs: FitJob[];
  storyType: StoryType | undefined;
}): ChatMessage[] {
  const jobs = input.jobs.slice(0, MAX_FIT_JOBS).map((job, i) => {
    const lines = [
      `j${i + 1}: ${job.title}${job.company ? ` at ${job.company}` : ""}`,
      `Level: ${levelLabel(job.level) ?? "not set"}`,
    ];
    if (job.focus.length) {
      lines.push("What interviewers will look for:", ...job.focus.map((f) => `- ${f}`));
    } else if (job.description.trim()) {
      lines.push("Posting:", job.description.trim().slice(0, MAX_DESCRIPTION_IN_PROMPT));
    }
    if (job.questions.length) {
      lines.push("Likely questions:", ...job.questions.map((q, n) => `${n + 1}. ${q}`));
    }
    return lines.join("\n");
  });
  return [
    {
      role: "user",
      content: [
        input.storyType ? `Story type: ${input.storyType.label}` : "",
        `The story as I'd tell it:\n\n${input.storyText}`,
        `My target jobs:\n\n${jobs.join("\n\n")}`,
        `My own answers the story was written from:\n\n${input.answers.slice(0, MAX_ANSWERS_IN_PROMPT)}`,
      ]
        .filter(Boolean)
        .join("\n\n---\n\n"),
    },
  ];
}

export function parseFit(text: string, jobs: FitJob[], model: string): ContentCheck {
  const json = extractJson(text);
  if (!isRecord(json) || !isRecord(json.jobs)) {
    throw new Error("The content check came back in an unexpected format.");
  }
  const raw = json.jobs;
  const fits = jobs.slice(0, MAX_FIT_JOBS).flatMap((job, i): JobFit[] => {
    const entry = raw[`j${i + 1}`];
    if (!isRecord(entry)) return [];
    const fit = FIT_LEVELS.find((f) => f === entry.fit);
    if (!fit) return [];
    const answers = Array.isArray(entry.answers)
      ? [...new Set(entry.answers.map(Number))]
          .filter((n) => Number.isInteger(n) && n >= 1 && n <= job.questions.length)
          .map((n) => job.questions[n - 1])
      : [];
    const levelRaw = isRecord(entry.level) ? entry.level : undefined;
    const match = LEVEL_MATCH.find((m) => m === levelRaw?.match);
    return [
      {
        jobId: job.id,
        title: job.title,
        company: job.company ?? "",
        fit,
        proves: stringList(entry.proves, 3),
        misses: stringList(entry.misses, 3),
        answers,
        ...(match && job.level ? { level: { match, note: str(levelRaw?.note) } } : {}),
      },
    ];
  });
  return { jobs: fits, unused: stringList(json.unused, 3), model };
}

// Reads a saved content check defensively: it lives in stories.content jsonb.
export function parseStoredFit(raw: unknown): ContentCheck | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.jobs)) return undefined;
  const jobs = raw.jobs.filter(isRecord).flatMap((j): JobFit[] => {
    const fit = FIT_LEVELS.find((f) => f === j.fit);
    if (!fit || typeof j.jobId !== "string") return [];
    const levelRaw = isRecord(j.level) ? j.level : undefined;
    const level = LEVEL_MATCH.find((m) => m === levelRaw?.match);
    return [
      {
        jobId: j.jobId,
        title: str(j.title),
        company: str(j.company),
        fit,
        proves: stringList(j.proves, 3),
        misses: stringList(j.misses, 3),
        answers: stringList(j.answers, 10),
        ...(level ? { level: { match: level, note: str(levelRaw?.note) } } : {}),
      },
    ];
  });
  return { jobs, unused: stringList(raw.unused, 3), model: str(raw.model) };
}

function stringList(value: unknown, max: number): string[] {
  return Array.isArray(value)
    ? value
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        .map((v) => v.trim().slice(0, 300))
        .slice(0, max)
    : [];
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 300) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

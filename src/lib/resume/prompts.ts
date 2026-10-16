import type { ChatMessage } from "@/lib/ai/types";
import { levelLabel } from "@/lib/jobs/content";
import { extractJson } from "@/lib/stories/prompts";
import {
  FITS,
  MAX_BULLETS_PER_STORY,
  MAX_BULLET_WORDS,
  MAX_STORIES,
  MAX_SUMMARY_WORDS,
  type FinishedStory,
  type FitId,
} from "./content";

// The one model call in the resume enhancer (resumeBullets): resume bullets from the user's
// finished stories, marked for how well each fits one target job, and a two-line summary from the
// About me for that job. Figures, length and role names are checked in code afterwards (build.ts).

const MAX_ANSWERS_PER_STORY = 4000;
const MAX_DESCRIPTION = 3000;
const MAX_RESUME = 6000;
const MAX_QUESTIONS = 8;

export const RESUME_SYSTEM = `You are a resume writer helping an experienced professional update the resume they already have for one specific job. You turn their interview stories, which they built from their own answers, into resume bullets. Recruiters skim, so each bullet must show what they did and what came of it.

The hard rule: use only facts and figures the user gave. Copy every figure exactly as written in their answers or numbers; never add, round, inflate, convert, total or combine numbers, and never borrow a figure from one story for another. Never invent a result, a scope, a team size, a tool or a title. If a story has no number for its result, write the bullet without one: a plain, true bullet beats an invented metric.

Bullets:
- Up to ${MAX_BULLETS_PER_STORY} bullets per story: one is usually right; write a second only when the story holds a second, separate result worth its own line.
- Each bullet is action plus result: start with a strong past-tense verb (Led, Cut, Built, Won, Rebuilt…), say what they did, then what came of it, with the figure when there is one. Under ${MAX_BULLET_WORDS} words. No "I", no "Responsible for", no "Helped" unless helping is all they did, no adjectives about themselves, no trailing period.
- Keep the user's own words for the work where you can, so they recognize it. Use the job's words only where they describe the same thing the user did.
- role: for each bullet, the job title and employer the story happened at, copied as written in their answers or resume. Leave either empty when it isn't stated; never guess.
- fit: how well the bullet shows what this job needs: "strong" when it proves something the job's interviewers care most about, "some" when it's relevant but not the core, "none" when this job doesn't need it.
- why: a few words on which need of this job it shows (e.g. "posting leads with enterprise renewals"). Empty for "none".
- List the bullets most relevant to this job first.

Summary: two lines (one or two sentences, under ${MAX_SUMMARY_WORDS} words in all) for the top of the resume, aimed at this job. Draw it only from the About me given: who they are and the one thing they bring this job. Resume voice, no "I". If no About me is given, return an empty string.

Reply with JSON only, no other text:
{"summary": "…", "bullets": [{"story": "s1", "title": "…", "company": "…", "text": "…", "fit": "${FITS.map((f) => f.id).join('" | "')}", "why": "…"}]}`;

export type ResumeJob = {
  title: string;
  company: string | null;
  level: string | null;
  description: string;
  // What its interviewers will look for, from the read of the user's jobs.
  focus: string[];
  questions: string[];
};

export type ResumeRetry = { previous: string; problems: string[] };

export function resumeMessages(input: {
  job: ResumeJob;
  stories: FinishedStory[];
  // The About me for this job (or the general one), as written.
  aboutMe: string;
  // Filled-in numbers checklist lines, e.g. "Team size: 6 AEs".
  numbers: string[];
  resume: string;
  retry?: ResumeRetry;
}): ChatMessage[] {
  const { job } = input;
  const level = levelLabel(job.level);
  const jobLines = [
    `## The job: ${job.title}${job.company ? ` at ${job.company}` : ""}${level ? ` (${level})` : ""}`,
  ];
  if (job.focus.length) {
    jobLines.push("What its interviewers will look for:", ...job.focus.map((f) => `- ${f}`));
  }
  if (job.questions.length) {
    jobLines.push(
      "Likely interview questions:",
      ...job.questions.slice(0, MAX_QUESTIONS).map((q) => `- ${q}`),
    );
  }
  if (job.description.trim()) {
    jobLines.push("The posting:", job.description.trim().slice(0, MAX_DESCRIPTION));
  }

  const stories = input.stories
    .slice(0, MAX_STORIES)
    .map((s, i) =>
      [
        `### s${i + 1}: "${s.title}" (${s.typeLabel})`,
        `The story as written:\n${s.story}`,
        `The answers it was written from:\n${s.answers.slice(0, MAX_ANSWERS_PER_STORY)}`,
      ].join("\n\n"),
    );

  const parts = [jobLines.join("\n"), `## My finished stories\n\n${stories.join("\n\n")}`];
  if (input.numbers.length) {
    parts.push(
      `## My numbers checklist (mine; use one only in a bullet about the same work)\n${input.numbers.map((n) => `- ${n}`).join("\n")}`,
    );
  }
  parts.push(
    input.aboutMe.trim()
      ? `## My About me for this job\n${input.aboutMe.trim()}`
      : "## My About me for this job\nNone yet. Return an empty summary.",
  );
  if (input.resume.trim()) {
    parts.push(
      `## My current resume (only to name the title and employer each story happened at)\n${input.resume.trim().slice(0, MAX_RESUME)}`,
    );
  }

  const messages: ChatMessage[] = [
    {
      role: "user",
      content: `Write resume bullets from my stories for this job.\n\n${parts.join("\n\n")}`,
    },
  ];
  if (input.retry) {
    messages.push(
      { role: "assistant", content: input.retry.previous },
      {
        role: "user",
        content: `Fix these and reply with the whole JSON again:\n${input.retry.problems.map((p) => `- ${p}`).join("\n")}`,
      },
    );
  }
  return messages;
}

export type RawBullet = {
  // Index into the stories given, from 0.
  story: number;
  title: string;
  company: string;
  text: string;
  fit: FitId;
  why: string;
};

export function parseResumeReply(
  text: string,
  storyCount: number,
): { summary: string; bullets: RawBullet[] } {
  const json = extractJson(text);
  if (!isRecord(json)) throw new Error("The bullets came back in an unexpected format.");
  const perStory = new Map<number, number>();
  const bullets: RawBullet[] = [];
  for (const b of Array.isArray(json.bullets) ? json.bullets : []) {
    if (!isRecord(b) || typeof b.text !== "string" || !b.text.trim()) continue;
    const match = typeof b.story === "string" ? /^s(\d+)$/i.exec(b.story.trim()) : null;
    const story = match ? Number(match[1]) - 1 : -1;
    if (story < 0 || story >= Math.min(storyCount, MAX_STORIES)) continue;
    const count = perStory.get(story) ?? 0;
    if (count >= MAX_BULLETS_PER_STORY) continue;
    perStory.set(story, count + 1);
    bullets.push({
      story,
      title: str(b.title),
      company: str(b.company),
      text: b.text,
      fit: FITS.find((f) => f.id === b.fit)?.id ?? "some",
      why: str(b.why),
    });
  }
  if (bullets.length === 0) throw new Error("No bullets came back. Try again.");
  return { summary: str(json.summary), bullets };
}

function str(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

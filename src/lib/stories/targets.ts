import { levelLabel, type LevelId } from "@/lib/jobs/content";
import { QUESTION_THEMES } from "@/lib/questions/themes";
import type { StoryType } from "./story-types";

// What the user is preparing for, so the builder's questions can aim at it: their target jobs (title,
// company, level, what interviewers will look for, the likely questions this kind of story answers)
// and, from their "Tell me about yourself", the role they said they want next. Plain code, so the
// builder can show a hint under the scripted questions as well as pass it to the follow-ups.

export type TargetJobBrief = {
  title: string;
  company: string | null;
  level: string | null;
  // What the job's interviewers will look for, from the jobs read.
  focus: string[];
  // The job's likely questions that this kind of story answers, best first.
  questions: string[];
};

export type BuilderTargets = {
  jobs: TargetJobBrief[];
  // Their own answer to "What are you looking for next?", from "Tell me about yourself".
  wantedRole?: string;
};

export const MAX_TARGET_JOBS = 5;
const MAX_FOCUS_PER_JOB = 5;
const MAX_QUESTIONS_PER_JOB = 3;
const MAX_WANTED_ROLE_LENGTH = 800;

type JobLike = {
  title: string;
  company: string | null;
  level: string | null;
  likelyQuestions: { questions: { question: string; theme: string }[] } | null;
};

// Builds the targets for one story type from the user's jobs, the jobs read and their About me.
export function builderTargets(input: {
  jobs: (JobLike & { id: string })[];
  focus?: Record<string, { focus: string[] } | undefined>;
  wantedRole?: string;
  storyType: StoryType | undefined;
}): BuilderTargets {
  const themes = themesFor(input.storyType);
  const jobs = input.jobs.slice(0, MAX_TARGET_JOBS).map((job) => ({
    title: job.title,
    company: job.company,
    level: job.level,
    focus: (input.focus?.[job.id]?.focus ?? []).slice(0, MAX_FOCUS_PER_JOB),
    questions: (job.likelyQuestions?.questions ?? [])
      .filter((q) => themes.has(q.theme))
      .map((q) => q.question)
      .slice(0, MAX_QUESTIONS_PER_JOB),
  }));
  const wantedRole = input.wantedRole?.trim().slice(0, MAX_WANTED_ROLE_LENGTH);
  return { jobs, ...(wantedRole ? { wantedRole } : {}) };
}

export function hasTargets(
  targets: BuilderTargets | undefined,
): targets is BuilderTargets {
  return Boolean(targets && (targets.jobs.length > 0 || targets.wantedRole));
}

function themesFor(storyType: StoryType | undefined): Set<string> {
  if (!storyType) return new Set();
  return new Set(
    QUESTION_THEMES.filter((t) =>
      (t.storyTypes as readonly string[]).includes(storyType.id),
    ).map((t) => t.id),
  );
}

export function jobName(job: {
  title: string;
  company: string | null;
}): string {
  return job.company ? `${job.title} at ${job.company}` : job.title;
}

// The scope of story each level's interviewers expect, for the follow-ups and the hint.
const LEVEL_SCOPE: Record<LevelId, { probe: string; hint: string }> = {
  entry: {
    probe:
      "Entry level: interviewers want to see how they learn, take ownership of their part and work with others. School, internships, part-time jobs, volunteering and side projects all count. Ask what they did themselves, what they learned and what they would do differently.",
    hint: "an example where you took ownership of your part, from work, school or a project",
  },
  mid: {
    probe:
      "Mid-level: interviewers want hands-on depth and clear ownership of a result. Ask what they did themselves and how well it worked.",
    hint: "an example where you owned the result yourself",
  },
  senior: {
    probe:
      "Senior: interviewers want them leading work across a team or project, making the call and bringing others along. Ask who they led or influenced and how many people or teams the work touched.",
    hint: "an example where you led the work across a team",
  },
  principal: {
    probe:
      "Principal or above: interviewers want impact across teams or the whole organization, setting direction and influencing without authority. Ask how far the work reached (teams, the org, customers) and what changed beyond their own team.",
    hint: "an example whose impact reached across teams or the organization",
  },
};

function levelOf(job: TargetJobBrief): LevelId | undefined {
  return job.level && job.level in LEVEL_SCOPE
    ? (job.level as LevelId)
    : undefined;
}

// The most senior level among the jobs: a story that shows that scope serves the others too.
function topLevel(jobs: TargetJobBrief[]): LevelId | undefined {
  const order: LevelId[] = ["principal", "senior", "mid", "entry"];
  return order.find((l) => jobs.some((j) => levelOf(j) === l));
}

// For the follow-up call: what they're preparing for, after their answers.
export function targetsTranscript(targets: BuilderTargets): string {
  const lines = ["## What I'm preparing for"];
  if (targets.wantedRole) {
    lines.push(
      "What I said I'm looking for next, in my words:",
      targets.wantedRole,
      "",
    );
  }
  targets.jobs.forEach((job, i) => {
    lines.push(`Target job ${i + 1}: ${jobName(job)}`);
    const level = levelLabel(job.level);
    if (level) lines.push(`Level: ${level}`);
    if (job.focus.length) {
      lines.push(
        "What its interviewers will look for:",
        ...job.focus.map((f) => `- ${f}`),
      );
    }
    if (job.questions.length) {
      lines.push(
        "Its likely questions that this story should answer:",
        ...job.questions.map((q) => `- ${q}`),
      );
    }
    lines.push("");
  });
  const level = topLevel(targets.jobs);
  if (level) lines.push(`Scope to draw out: ${LEVEL_SCOPE[level].probe}`);
  return lines.join("\n").trim();
}

// Added to the follow-up instructions when there are targets.
const TARGET_RULES = `Tailor to what they're preparing for. Their target jobs and the role they want are listed after their answers.
- Aim your questions at what those jobs' interviewers will look for and at the likely questions this story should answer, where their answers don't show it yet. When a question is aimed at a job, say so in a few words so they know why you ask ("Stripe's role leans on enterprise deals, so: how big was the largest account here?"). Do this for at most two questions; the rest stay plain.
- Draw out the scope their target level expects (see "Scope to draw out"), in their own story: what that level looks for, such as who they led or influenced and how far the work reached, or for entry level what they owned and learned.
- Ask; never assume they have the experience a job asks for. If the story doesn't touch something a job needs, ask once whether it does, lightly, and don't push if it doesn't.
- Never ask about the company or the job itself, and never quote the posting at them. The questions are still about their own story.
- With several jobs, favour what they share; ask about one job's particular need only when it's what the story could prove best.`;

const INTRO_TARGET_RULES = `For "Tell me about yourself", the "next" part is where the target jobs meet their story: if their answer doesn't yet connect their path to these roles, ask lightly what draws them to roles like these, or which part of their path the jobs would build on.`;

export function targetRules(storyType: StoryType | undefined): string {
  return storyType?.format === "intro"
    ? `${TARGET_RULES}\n- ${INTRO_TARGET_RULES}`
    : TARGET_RULES;
}

// A one-line nudge under the first scripted question, so they pick a story that fits. Code only.
export function openingHint(
  targets: BuilderTargets | undefined,
  storyType: StoryType | undefined,
): string | undefined {
  if (!hasTargets(targets) || !storyType) return undefined;
  if (storyType.format === "intro") {
    // About me: the "what next" question is where the targets matter.
    return undefined;
  }
  const jobs = targets.jobs;
  if (jobs.length === 0) return undefined;
  const lead = jobs.find((j) => j.questions.length > 0) ?? jobs[0];
  const others = jobs.length - 1;
  const where = `${jobName(lead)}${others > 0 ? ` (and ${others} more ${others === 1 ? "job" : "jobs"})` : ""}`;
  const parts = [`You're preparing for ${where}.`];
  if (lead.questions[0]) {
    parts.push(
      `Pick an example that would answer “${lead.questions[0].replace(/\.+$/, "")}”`,
    );
  } else {
    parts.push("Pick an example that shows what that job needs");
  }
  const level = topLevel(jobs);
  parts[1] += level ? `, ideally ${LEVEL_SCOPE[level].hint}.` : ".";
  return parts.join(" ");
}

// A nudge under "What are you looking for next?" in "Tell me about yourself", naming their jobs.
export function nextRoleHint(
  targets: BuilderTargets | undefined,
): string | undefined {
  if (!targets || targets.jobs.length === 0) return undefined;
  const names = targets.jobs.slice(0, 3).map(jobName);
  const more = targets.jobs.length - names.length;
  const list =
    more > 0
      ? `${names.join(", ")} and ${more} more`
      : names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `You've added ${list} as target ${targets.jobs.length === 1 ? "job" : "jobs"}. Say what draws you to ${targets.jobs.length === 1 ? "that role" : "roles like these"}, in your own words.`;
}

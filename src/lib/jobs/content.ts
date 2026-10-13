import { STORY_TYPES, REQUIRED_STORY_TYPE_ID, type StoryTypeId } from "@/lib/stories/story-types";

// Target jobs (PRD, step 1): the user's resume, the jobs they're going for, and one model call's read
// of what the jobs share, where each differs, and which stories to build first.

export const MAX_JOBS = 5;
export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 15000;
// A posting shorter than this is usually just a title; ask for the full text.
export const MIN_DESCRIPTION_LENGTH = 200;
export const MAX_RESUME_LENGTH = 20000;
export const RESUME_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"] as const;

// The role levels the PRD names. Suggested from the title in code, confirmed by the user.
export const LEVELS = [
  { id: "mid", label: "Mid-level" },
  { id: "senior", label: "Senior" },
  { id: "principal", label: "Principal or above" },
] as const;

export type LevelId = (typeof LEVELS)[number]["id"];

export function levelLabel(id: string | null | undefined): string | undefined {
  return LEVELS.find((l) => l.id === id)?.label;
}

export function isLevel(id: unknown): id is LevelId {
  return LEVELS.some((l) => l.id === id);
}

const PRINCIPAL_RE =
  /\b(principal|staff|distinguished|fellow|director|head of|vp|svp|evp|vice president|chief|cto|cfo|coo|ceo|cio|cdo)\b/i;
const SENIOR_RE = /\b(senior|sr|lead|iii)\b/i;

// The level a job title suggests, from keywords alone. The user confirms or changes it.
export function suggestLevel(title: string): LevelId {
  if (PRINCIPAL_RE.test(title)) return "principal";
  if (SENIOR_RE.test(title)) return "senior";
  return "mid";
}

export type Resume = {
  // Empty when pasted.
  fileName: string;
  text: string;
  updatedAt: string;
};

export type JobRead = {
  // One sentence: what the role is.
  summary: string;
  // One sentence: how it differs from the user's other target jobs. Empty with one job.
  differs: string;
  // What this job's interviewers will look for, from the posting.
  focus: string[];
};

export type StoryPriority = {
  storyType: StoryTypeId;
  why: string;
};

// The model's read of all the user's target jobs together, kept on profiles.jobs_overview.
export type JobsOverview = {
  // What the jobs have in common that interviewers will probe.
  shared: string[];
  jobs: Record<string, JobRead>;
  // Present when there was a resume to read.
  resumeFit?: { strengths: string[]; gaps: string[] };
  // Every story type, most needed first. "Tell me about yourself" is always first.
  storyOrder: StoryPriority[];
  // What the read was based on, so the page can tell when it is out of date.
  basis: string;
  model: string;
  readAt: string;
};

// Changes whenever a job is added or removed or the resume changes.
export function overviewBasis(jobIds: string[], resume: Resume | null): string {
  return [...jobIds].sort().join(",") + "|" + (resume?.updatedAt ?? "");
}

// Puts "Tell me about yourself" first and makes sure every story type appears exactly once.
export function completeStoryOrder(order: StoryPriority[]): StoryPriority[] {
  const seen = new Set<string>();
  const result: StoryPriority[] = [];
  const required = order.find((p) => p.storyType === REQUIRED_STORY_TYPE_ID);
  result.push({
    storyType: REQUIRED_STORY_TYPE_ID,
    why: required?.why || "Opens almost every interview.",
  });
  seen.add(REQUIRED_STORY_TYPE_ID);
  for (const p of order) {
    if (seen.has(p.storyType)) continue;
    seen.add(p.storyType);
    result.push(p);
  }
  for (const t of STORY_TYPES) {
    if (!seen.has(t.id)) result.push({ storyType: t.id, why: "" });
  }
  return result;
}

export function isStoryTypeId(id: unknown): id is StoryTypeId {
  return STORY_TYPES.some((t) => t.id === id);
}

export function parseResume(raw: unknown): Resume | null {
  if (!isRecord(raw) || typeof raw.text !== "string" || !raw.text) return null;
  return {
    fileName: typeof raw.fileName === "string" ? raw.fileName : "",
    text: raw.text,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

// Reads profiles.jobs_overview defensively: it is jsonb, so its shape isn't guaranteed.
export function parseOverview(raw: unknown): JobsOverview | null {
  if (!isRecord(raw) || !isRecord(raw.jobs)) return null;
  const jobs: Record<string, JobRead> = {};
  for (const [id, job] of Object.entries(raw.jobs)) {
    if (!isRecord(job)) continue;
    jobs[id] = {
      summary: str(job.summary),
      differs: str(job.differs),
      focus: strings(job.focus),
    };
  }
  const fit = isRecord(raw.resumeFit)
    ? { strengths: strings(raw.resumeFit.strengths), gaps: strings(raw.resumeFit.gaps) }
    : undefined;
  return {
    shared: strings(raw.shared),
    jobs,
    ...(fit ? { resumeFit: fit } : {}),
    storyOrder: completeStoryOrder(storyPriorities(raw.storyOrder)),
    basis: str(raw.basis),
    model: str(raw.model),
    readAt: str(raw.readAt),
  };
}

export function storyPriorities(raw: unknown): StoryPriority[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((p) => {
    if (typeof p === "string" && isStoryTypeId(p)) return [{ storyType: p, why: "" }];
    if (isRecord(p) && isStoryTypeId(p.storyType)) {
      return [{ storyType: p.storyType, why: str(p.why) }];
    }
    return [];
  });
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "").map((v) => v.trim())
    : [];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

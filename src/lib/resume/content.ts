import { countWords } from "@/lib/stories/grading";
import type { StoryContent } from "@/lib/stories/content";
import { findNumbers, untracedNumbers } from "@/lib/stories/numbers";
import { getStoryType } from "@/lib/stories/story-types";

// Resume enhancer (PRD v0.3, P1): the story bank already holds what a strong resume bullet needs
// (the action, the stakes and a traced number), so finished stories become resume bullets, so prep
// and resume quote the same figures. One model call per target job (resumeBullets, see build.ts)
// writes one or two bullets per finished story, marks how well each fits the job, and writes a
// two-line summary from that job's About me. Everything else is code: every figure is checked
// against the story's own answers and the numbers checklist (a bullet whose figure can't be traced
// is left out), the bullets are ordered for the job and grouped by role, ready to copy into the
// user's existing resume. Kept on target_jobs.resume_bullets (jsonb).

export const FITS = [
  { id: "strong", label: "Strong fit" },
  { id: "some", label: "Some fit" },
  { id: "none", label: "Not for this job" },
] as const;

export type FitId = (typeof FITS)[number]["id"];

export type ResumeBullet = {
  id: string;
  storyId: string;
  storyTitle: string;
  // Where it goes on the resume: title and employer as the user wrote them. Empty when unnamed.
  role: string;
  text: string;
  fit: FitId;
  // A few words on which of the job's needs it shows.
  why: string;
  // In the set for this job. Starts as fit !== "none"; the user can add or remove.
  picked: boolean;
  // Figures not found in the story's answers or the numbers checklist. Empty for bullets as
  // written (untraced ones are left out); can appear after the user edits one.
  untracedNumbers: string[];
  edited?: boolean;
};

export type ResumeSet = {
  // Two lines for the top of the resume, from the About me for this job. Empty without one.
  summary: string;
  summarySource: "tailored" | "general" | "";
  bullets: ResumeBullet[];
  // The draft each story was at (story id → draft.writtenAt), to tell when the set is out of date.
  stories: Record<string, string>;
  // Bullets the writer gave that were left out because a figure couldn't be traced.
  leftOut: number;
  model: string;
  generatedAt: string;
};

export const MAX_BULLETS_PER_STORY = 2;
// Resume bullets are one line or two. Longer ones get cut by recruiters.
export const MAX_BULLET_WORDS = 35;
export const MAX_SUMMARY_WORDS = 60;
export const MAX_BULLET_LENGTH = 400;
export const MAX_SUMMARY_LENGTH = 600;
// The most stories one call reads. The newest finished ones go first.
export const MAX_STORIES = 12;
// The PRD's bar: five finished stories make a useful set.
export const GOOD_SET_STORIES = 5;
export const UNNAMED_ROLE = "Role not named in your answers";

// A finished story, as the enhancer needs it.
export type FinishedStory = {
  id: string;
  title: string;
  typeLabel: string;
  // The written story.
  story: string;
  // The answers it was written from, as a transcript.
  answers: string;
  // Everything the user typed for it plus their numbers checklist values: figures must trace here.
  source: string;
  draftWrittenAt: string;
};

// A story the enhancer reads: a behavioral story with a written draft. "Tell me about yourself"
// feeds the summary instead, and tough-question answers aren't achievements.
export function isFinishedStory(story: {
  storyType: string | null;
  content: StoryContent;
}): boolean {
  return getStoryType(story.storyType)?.format === "star" && Boolean(story.content.draft);
}

export function fitRank(fit: FitId): number {
  return FITS.findIndex((f) => f.id === fit);
}

export function newBulletId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// Bullets as resumes print them: no leading marker, no trailing period, one space between words.
export function cleanBullet(text: string): string {
  return text
    .replace(/^\s*(?:[-•*·▪●]|\d+[.)])\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.$/, "")
    .slice(0, MAX_BULLET_LENGTH);
}

// Problems with one bullet as written, in words the writer can fix on a retry.
export function bulletProblems(text: string, source: string): string[] {
  const problems: string[] = [];
  const untraced = untracedNumbers(text, source);
  if (untraced.length) {
    problems.push(
      `uses ${untraced.map((n) => `"${n}"`).join(", ")}, which isn't in that story's answers or the numbers checklist`,
    );
  }
  if (countWords(text) > MAX_BULLET_WORDS) problems.push(`is over ${MAX_BULLET_WORDS} words`);
  if (/^(i|we|my|our)\b/i.test(text))
    problems.push(`starts with "${text.split(/\s/)[0]}"; start with the verb`);
  if (/\bresponsible for\b/i.test(text)) problems.push(`says "responsible for"; say what was done`);
  return problems;
}

export function summaryProblems(summary: string, source: string): string[] {
  if (!summary) return [];
  const problems: string[] = [];
  const untraced = untracedNumbers(summary, source);
  if (untraced.length) {
    problems.push(
      `The summary uses ${untraced.map((n) => `"${n}"`).join(", ")}, which isn't in the About me answers`,
    );
  }
  if (countWords(summary) > MAX_SUMMARY_WORDS) {
    problems.push(`The summary is over ${MAX_SUMMARY_WORDS} words; keep it to two lines`);
  }
  return problems;
}

// Keeps the parts of a role name ("Senior PM", "Acme") the user actually wrote somewhere, so a
// bullet never lands under a title or employer they didn't have.
export function checkedRole(title: string, company: string, source: string): string {
  const haystack = normalizeForMatch(source);
  const kept = [title, company]
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p && p.length <= 80 && haystack.includes(normalizeForMatch(p)));
  return kept.join(", ");
}

function normalizeForMatch(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9&+]+/g, " ")
    .trim()} `;
}

// Whether a bullet carries a figure. Bullets without one are fine (never invent one), but the
// panel points at the numbers checklist for them.
export function hasFigure(text: string): boolean {
  return findNumbers(text, { includeCommonWords: false }).length > 0;
}

// The picked bullets grouped by role, roles in the order their first bullet comes.
export function groupByRole(bullets: ResumeBullet[]): { role: string; bullets: ResumeBullet[] }[] {
  const groups: { role: string; bullets: ResumeBullet[] }[] = [];
  for (const b of bullets.filter((x) => x.picked)) {
    const role = b.role || UNNAMED_ROLE;
    const group = groups.find((g) => g.role === role);
    if (group) group.bullets.push(b);
    else groups.push({ role, bullets: [b] });
  }
  // Bullets with no role last: the user decides where they go.
  return [
    ...groups.filter((g) => g.role !== UNNAMED_ROLE),
    ...groups.filter((g) => g.role === UNNAMED_ROLE),
  ];
}

// The set as plain text, to paste into a resume.
export function resumeText(set: Pick<ResumeSet, "summary" | "bullets">): string {
  const blocks: string[] = [];
  if (set.summary) blocks.push(set.summary);
  for (const g of groupByRole(set.bullets)) {
    blocks.push([g.role, ...g.bullets.map((b) => `• ${b.text}`)].join("\n"));
  }
  return blocks.join("\n\n");
}

// Finished stories that are new, rewritten or gone since the set was made.
export function changedStories(
  set: Pick<ResumeSet, "stories">,
  finished: { id: string; draftWrittenAt: string }[],
): number {
  const now = new Map(finished.map((s) => [s.id, s.draftWrittenAt]));
  let changed = 0;
  for (const [id, at] of now) if (set.stories[id] !== at) changed++;
  for (const id of Object.keys(set.stories)) if (!now.has(id)) changed++;
  return changed;
}

// Orders bullets for the job: strong fit first, then some, then none; the writer's order within.
export function orderForJob(bullets: ResumeBullet[]): ResumeBullet[] {
  return bullets
    .map((b, i) => ({ b, i }))
    .sort((x, y) => fitRank(x.b.fit) - fitRank(y.b.fit) || x.i - y.i)
    .map(({ b }) => b);
}

// Reads target_jobs.resume_bullets, or a list sent from the browser, defensively.
export function parseBullets(raw: unknown): ResumeBullet[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set<string>();
  const result: ResumeBullet[] = [];
  for (const b of raw) {
    if (!isRecord(b) || typeof b.text !== "string" || typeof b.storyId !== "string") continue;
    const text = cleanBullet(b.text);
    if (!text) continue;
    let id = typeof b.id === "string" && /^[a-z0-9-]{1,40}$/i.test(b.id) ? b.id : newBulletId();
    while (ids.has(id)) id = newBulletId();
    ids.add(id);
    const fit = FITS.find((f) => f.id === b.fit)?.id ?? "some";
    result.push({
      id,
      storyId: b.storyId,
      storyTitle: str(b.storyTitle, 200),
      role: str(b.role, 200),
      text,
      fit,
      why: str(b.why, 200),
      picked: typeof b.picked === "boolean" ? b.picked : fit !== "none",
      untracedNumbers: Array.isArray(b.untracedNumbers)
        ? b.untracedNumbers.filter((n): n is string => typeof n === "string").slice(0, 10)
        : [],
      ...(b.edited === true ? { edited: true } : {}),
    });
    if (result.length >= MAX_STORIES * MAX_BULLETS_PER_STORY) break;
  }
  return result;
}

export function parseResumeSet(raw: unknown): ResumeSet | null {
  if (!isRecord(raw)) return null;
  const bullets = parseBullets(raw.bullets);
  if (bullets.length === 0) return null;
  const stories: Record<string, string> = {};
  if (isRecord(raw.stories)) {
    for (const [id, at] of Object.entries(raw.stories))
      if (typeof at === "string") stories[id] = at;
  }
  return {
    summary: str(raw.summary, MAX_SUMMARY_LENGTH),
    summarySource:
      raw.summarySource === "tailored" || raw.summarySource === "general" ? raw.summarySource : "",
    bullets,
    stories,
    leftOut: typeof raw.leftOut === "number" && raw.leftOut > 0 ? Math.floor(raw.leftOut) : 0,
    model: str(raw.model, 200),
    generatedAt: str(raw.generatedAt, 40),
  };
}

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

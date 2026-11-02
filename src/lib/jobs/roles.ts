import { isLevel, isRecord, type LevelId } from "./content";
import type { LikelyQuestion } from "@/lib/questions/content";

// Several roles at one company in one target job (Nov 2: Craig was up for three Solutions
// Engineer roles at one company, aiming for the most senior). It's one interview process, so it's
// one job: the job's own title, level and posting are the main role, the one the prep aims at,
// and the other roles sit beside it on target_jobs.other_roles. Everything else (questions,
// stories, dates, interviews, outcome) is shared. The main role can be swapped for another.

export const MAX_OTHER_ROLES = 3;

export type JobRole = {
  id: string;
  title: string;
  level: LevelId | null;
  levelConfirmed: boolean;
  description: string;
  addedAt: string;
};

export function parseOtherRoles(raw: unknown): JobRole[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const roles: JobRole[] = [];
  for (const r of raw) {
    if (!isRecord(r) || typeof r.id !== "string" || typeof r.title !== "string") continue;
    if (!r.id || seen.has(r.id)) continue;
    seen.add(r.id);
    roles.push({
      id: r.id.slice(0, 64),
      title: r.title.trim() || "Untitled role",
      level: isLevel(r.level) ? r.level : null,
      levelConfirmed: r.levelConfirmed === true,
      description: typeof r.description === "string" ? r.description : "",
      addedAt: typeof r.addedAt === "string" ? r.addedAt : "",
    });
    if (roles.length >= MAX_OTHER_ROLES) break;
  }
  return roles;
}

type MainFields = {
  title: string;
  level: string | null;
  levelConfirmed: boolean;
  description: string;
  createdAt: string;
};

// Makes another role the main one: it takes the job's title, level and posting, and the old main
// role takes its place in the list. Returns null when there's no such role.
export function swapMainRole(
  job: MainFields & { otherRoles: JobRole[] },
  roleId: string,
): (MainFields & { otherRoles: JobRole[] }) | null {
  const at = job.otherRoles.findIndex((r) => r.id === roleId);
  if (at < 0) return null;
  const next = job.otherRoles[at];
  const oldMain: JobRole = {
    id: roleId,
    title: job.title,
    level: isLevel(job.level) ? job.level : null,
    levelConfirmed: job.levelConfirmed,
    description: job.description,
    addedAt: job.createdAt,
  };
  const otherRoles = [...job.otherRoles];
  otherRoles[at] = oldMain;
  return {
    title: next.title,
    level: next.level,
    levelConfirmed: next.levelConfirmed,
    description: next.description,
    createdAt: job.createdAt,
    otherRoles,
  };
}

// The titles of every role in the job, the main one first.
export function roleTitles(job: { title: string; otherRoles: JobRole[] }): string[] {
  return [job.title, ...job.otherRoles.map((r) => r.title)];
}

// How a role's posting differs from the main role's, line by line, in plain code: postings for
// roles at one company are mostly the same text, so only the lines that changed are shown, with
// the changed words marked. Nothing is sent to a model, so nothing can be made up.

export type DiffSegment = { text: string; changed: boolean };
export type RoleDifference = {
  // Lines of this role's posting that aren't in the main one, changed words marked.
  lines: DiffSegment[][];
  // How many of this role's lines are word for word in the main posting.
  same: number;
  // True when there were more changed lines than are shown.
  more: boolean;
};

const MAX_DIFF_LINES = 8;

function postingLines(description: string): string[] {
  return description
    .split(/\n+/)
    .map((l) => l.replace(/^[-•*]\s*/, "").replace(/\s+/g, " ").trim())
    .filter((l) => l.length >= 3);
}

function lineKey(line: string): string {
  return line.toLowerCase().replace(/[^\p{L}\p{N}+$%]+/gu, " ").trim();
}

function words(line: string): string[] {
  return line.split(" ").filter(Boolean);
}

function wordKey(word: string): string {
  return word.toLowerCase().replace(/[^\p{L}\p{N}+$%]/gu, "");
}

function similarity(a: string[], b: string[]): number {
  const sa = new Set(a.map(wordKey));
  const sb = new Set(b.map(wordKey));
  let both = 0;
  for (const w of sa) if (sb.has(w)) both += 1;
  return both / Math.max(1, sa.size + sb.size - both);
}

// Marks the words of `line` that aren't in `base`, by longest common subsequence.
function markChanged(line: string[], base: string[]): DiffSegment[] {
  const a = line.map(wordKey);
  const b = base.map(wordKey);
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const kept = new Array<boolean>(a.length).fill(false);
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] === b[j]) {
      kept[i] = true;
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) i += 1;
    else j += 1;
  }
  const segments: DiffSegment[] = [];
  line.forEach((w, i) => {
    const changed = !kept[i];
    const last = segments[segments.length - 1];
    if (last && last.changed === changed) last.text += ` ${w}`;
    else segments.push({ text: segments.length ? ` ${w}` : w, changed });
  });
  // Keep the spaces outside the marks.
  return segments.flatMap((s) =>
    s.text.startsWith(" ") ? [{ text: " ", changed: false }, { text: s.text.slice(1), changed: s.changed }] : [s],
  );
}

export function roleDifference(description: string, mainDescription: string): RoleDifference {
  const main = postingLines(mainDescription);
  const mainKeys = new Set(main.map(lineKey));
  const mainWords = main.map(words);
  const changed: DiffSegment[][] = [];
  let same = 0;
  for (const line of postingLines(description)) {
    if (mainKeys.has(lineKey(line))) {
      same += 1;
      continue;
    }
    const w = words(line);
    let best = -1;
    let bestScore = 0;
    mainWords.forEach((m, i) => {
      const score = similarity(w, m);
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    changed.push(bestScore >= 0.5 ? markChanged(w, mainWords[best]) : [{ text: line, changed: true }]);
  }
  return { lines: changed.slice(0, MAX_DIFF_LINES), same, more: changed.length > MAX_DIFF_LINES };
}

// The changed lines as plain text, for the likely-questions prompt.
export function differenceText(diff: RoleDifference): string[] {
  return diff.lines.map((segments) => segments.map((s) => s.text).join(""));
}

// When the user is up for more than one role, interviewers ask how they think about that. Added in
// code (like the AI question) after the openers, so it's there without predicting again.
export function roleQuestion(otherRoles: { title: string }[]): LikelyQuestion | null {
  if (otherRoles.length === 0) return null;
  const titles = otherRoles.map((r) => r.title);
  const named =
    titles.length === 1 ? titles[0] : `${titles.slice(0, -1).join(", ")} or ${titles[titles.length - 1]}`;
  return {
    question: `We're also considering you for ${named}. How do you think about that?`,
    theme: "about_you",
    why: "you're up for more than one role here",
    source: "posting",
    specific: false,
  };
}

export function withRoleQuestion(
  questions: LikelyQuestion[],
  otherRoles: { title: string }[],
  max: number,
): LikelyQuestion[] {
  const q = roleQuestion(otherRoles);
  if (!q || questions.length === 0) return questions;
  const at = Math.min(2, questions.length);
  return [...questions.slice(0, at), q, ...questions.slice(at)].slice(0, max);
}
